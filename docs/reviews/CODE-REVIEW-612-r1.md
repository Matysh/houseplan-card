# CODE-REVIEW-612-r1

**Issue:** [#612](https://github.com/Matysh/houseplan-card/issues/612) — View: обработчик `conflict` бросает без загруженного редактора; `_syncNewDevices` пишет конфиг без `_canEdit`
**Трек:** `trivial` (короткий, лимит циклов код-ревью — 2)
**Заход:** r1 · блокирующих циклов израсходовано 0/2
**Материал:** `2cfb6d21697b8302a7e1e464d38e7f865e4dee88`, дерево `bb43d120a8a291da4d5a3286956356fbad41bb3d`, ветка `issue/612-view-config-guards`

## Скоуп

Два дефекта из аудита 22.09, оба в `src/houseplan-card.ts`, синхронизация конфига в View:

1. `.catch` конфликта записи конфига вызывал `this._cancelPath()` → `_editorRuntimeOrThrow()`, который **бросает**, если редактор не загружен. В View (household/kiosk) это гарантированно так — unhandled rejection, `_reloadConfigOnly(true)` не вызывался.
2. `_syncNewDevices` писала общий конфиг (`known_devices`/`new_device_ids`) без проверки `_canEdit`, в отличие от соседей `_seedHiddenDevices`/`_syncAreaRelocations`. При `admin_only` не-админ получал тост «Only administrators may edit the configuration» на каждое новое устройство HA.

AC (из тела issue):
- **AC1** (unit): карточка без `_editorRuntime`, конфликт при записи ⇒ вызван reload(force), без исключения.
- **AC2** (smoke): не-админ, `can_write=false`, `config/set` → `unauthorized`; новое устройство в `hass.devices` ⇒ 0 тостов, `known_devices` не пишется.
- **AC3**: мутанты на оба предиката.

## Как проверялось

Дешёвые гейты подтверждены зелёным Validate на точном SHA материала — https://github.com/Matysh/houseplan-card/actions/runs/35832762295 (`headSha` сверен: `2cfb6d21697b8302a7e1e464d38e7f865e4dee88`). Поверх этого прогнал сам, дополнительно, там где счёл риск нетривиальным.

| Гейт | Статус | Источник |
|---|---|---|
| `npx tsc --noEmit`, `npm run build` | зелёный | Validate job «Фронтенд: типы, юниты, мутанты, синхрон бандла» (success) **+** прогнал сам локально (`npm run build`, `npm run bundle:sync`) — чисто |
| `npm test` (юниты) | зелёный | тот же job; клеточно подтверждён лог `node --test test/config-write-conflict.test.mjs` → `ok` |
| bundle-sync (3 копии бандла) | зелёный | тот же job + собственный `npm run bundle:sync` без диффа в рабочей копии |
| `node scripts/check-docs.mjs` | зелёный | Validate job «Предполёт: документация…», шаг «Документация: гайды, ченджлоги, скриншот-индекс» — success; diff трогает `src/**`, поэтому гейт обязателен, и он выполнен |
| Мутанты по диффу (AC3) | зелёный, **оба witness подтверждены построчно** | см. таблицу защитных AC ниже — вытащил конкретные строки лога, а не поверил заявлению автора |
| `smoke-select.mjs --base origin/dev --head HEAD` | выполнил сам | 23 «прямых совпадения», 21 «слабая связь» (см. ниже) |
| Смоки (browser) | **прогнал сам** 7 из 23 прямых совпадений: `smoke_readonly_cold_start`, `smoke_cold_view_toggle`, `smoke_cold_view_vacuum`, `smoke_config_reload_race`, `smoke_save_race`, `smoke_ws_resilience`, `smoke_version_recovery` | все 7 — `OK`, exit 0 (полный вывод в логе сессии) |
| `golden:verify` | не гонял | diff не меняет разметку/CSS/геометрию — только логику записи конфига и извлечение чистой функции; видимый результат рендера не затронут |
| `pytest tests_backend` | не гонял | diff не трогает `custom_components/**/*.py` |
| `model-invariants` | не гонял | diff не трогает геометрию/`layout`/`marker.space`/`open_spans` |
| performance-профили | не гонял | не названы в AC, diff не трогает чувствительные к перфу пути (`src/iso-*`, `src/live-*`, `src/render-*`, `houseplan-render-lifecycle.ts`, `houseplan-card.ts` рендер-путь) — единственный тронутый файл этого списка правится вне рендер-цикла, только в `.catch` записи конфига |

**Почему прогнал смоки сам, хотя Validate зелёный:** «Смоки в браузере» в этом прогоне Validate — `skipped` (heavy-гейты идут только на beta-кандидате/nightly/PR, не на обычном push — так по контракту `classify-changes.mjs`/AGENTS.md). Мутационный джоб гонял только `smoke_readonly_cold_start.mjs` (он у него в `guard`), остальные 22 «прямых совпадения» по `_reloadConfigOnly`/`_editorRuntime`/`_cancelPath` никто в CI на этом SHA не касался. Часть изменённого пути (`.catch` конфликта) общая с этими смоками, поэтому выбрал 7 самых релевантных (cold-view без редактора + гонки/реконнект вокруг `_reloadConfigOnly`) и прогнал вручную — все зелёные, конфликтующих изменений в поведении с редактором нет.

## Защитный AC — таблица «чем краснеет» (§2.7)

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 — View-конфликт без editor runtime не бросает и делает reload | `node --test test/config-write-conflict.test.mjs` — лог Validate: `ok чистый прогон: node --test test/config-write-conflict.test.mjs` (07:40:43) | мутант `view-conflict-requires-editor-runtime` (`editorRuntime?._cancelPath()` → `editorRuntime!._cancelPath()`) — лог Validate job «Мутанты по диффу (5/6)»: `ok view-conflict-requires-editor-runtime: заявленный тест покраснел на мутанте` (07:43:01) |
| AC2 — не-админ не пишет `known_devices`, не получает тост | `node demo/smoke_readonly_cold_start.mjs` — лог Validate: `ok чистый прогон: node demo/smoke_readonly_cold_start.mjs` (07:41:09); дополнительно прогнал сам локально — `OK`, все 3 новых поля (`readonlyNewDeviceDoesNotWrite`, `readonlyNewDeviceDoesNotToast`, `readonlyKnownDevicesStayAuthoritative`) `true` | мутант `readonly-view-syncs-new-devices` (убирает `!this._canEdit` из предиката) — лог Validate job «Мутанты по диффу (6/6)»: `ok readonly-view-syncs-new-devices: заявленный тест покраснел на мутанте» (07:43:19) |

Оба witness'а проверены не по заявлению автора, а по строке лога Validate на материале ревью, плюс AC2 перепрогнан локально с тем же результатом.

## Находки

Нет. High: 0, Medium: 0, Low: 0.

## Что проверено и корректно

- **Дефект 1 закрыт именно так, как описан.** Новая чистая функция `recoverConfigWriteConflict` (`src/config-write-conflict.ts`) делает `editorRuntime?._cancelPath()` вместо `this._cancelPath()` → `_editorRuntimeOrThrow()`, который раньше бросал. Вызов на месте дефекта: `src/houseplan-card.ts:8019` — `recoverConfigWriteConflict(this._editorRuntime, () => this._reloadConfigOnly(true))`. Для случая с загруженным редактором поведение побитово то же, что раньше (cancel → reload); только путь «редактора нет» перестал бросать. Старый метод `_cancelPath()` (`houseplan-card.ts:9921`) не стал мёртвым кодом — он используется в editor-смоках (`smoke_plan_drawing_repairs`, `smoke_opening_inner_distances`, `smoke_plan_snap_overlay`, `smoke_opening_preview`), где редактор гарантированно загружен.
- **Дефект 2 закрыт правильным guard'ом.** `_canEdit` — существующий серверно-авторитетный предикат (`_serverCanWrite`/`auth.may_write`, fail-closed), уже применяемый соседями `_seedHiddenDevices` (`:4109`) и `_syncAreaRelocations` (`:5177`). `_syncNewDevices` теперь использует тот же предикат — не новое изобретение, а устранение расхождения с уже принятым паттерном. Устаревший комментарий «best-effort persist», описывавший поведение из v1.29.0, которого больше нет, — удалён.
- **Продуктовое следствие проверено, не только буква AC.** Гейтинг `_syncNewDevices` через `_canEdit` означает, что в доме без когда-либо залогиненного админа флаг «новое устройство» не проставится локально ни на одном клиенте — но это тот же контракт, что уже действует для скрытия по фильтру и area-relocation; #612 не вводит новую деградацию, а убирает расхождение одной функции с уже принятым инвариантом.
- **Трейлеры и changelog.** Один коммит `2cfb6d21`, `Issue: #612`, `User-Visible: yes`, оба changelog (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) правлены в этом же коммите, описание соответствует изменению. Ветка `issue/612-view-config-guards` подтверждена через GitHub API (`branches-where-head`).
- **Одно число — один источник**: неприменимо, diff не добавляет и не меняет отображаемую пользователю величину.
- **Классы риска (§2.6):** async (конфликт → принудительный reload без исключения) и данные/права (read-only клиент не пишет `known_devices`) — оба применимы и закрыты автотестами выше с подтверждённым «умеет падать». Геометрия/визуал/объём-перф/host-input — неприменимы, зафиксировано верно в аналитике автора и подтверждено по коду: diff не трогает рендер, геометрию, `layout` или новые i18n-ключи.
- **Объём изменения соразмерен `trivial`-треку**: одна поверхность (`src/houseplan-card.ts` + новый вспомогательный файл), без миграции конфига, без нового UX-контракта, без влияния на touch/perf/i18n.

## Чего не проверял

- `golden:verify`, `pytest tests_backend`, `model-invariants`, performance-профили — не запускал по причинам в таблице гейтов (не тронуты соответствующие поверхности).
- Полный набор 263 смоков — не прогонял; выбрал 23 «прямых совпадения» по `smoke-select.mjs`, из них вручную перепроверил 7 самых релевантных reload/conflict/cold-view сценариев (все зелёные), остальные 16 (в основном авторские editor-смоки на `_cancelPath`/`_editorRuntime` в контексте, где поведение не изменилось — draw/opening/snap-инструменты) и 21 «слабую связь» не гонял: путь, который меняет диф, специфичен для `.catch` записи конфига и `_syncNewDevices`, а не для рисования/привязки, риск регрессии там оценил как низкий и не покрытый диффом функционально.
- Не проверял состояние WIP-лимитов/меток за пределами данного issue — вне скоупа код-ревью.

## Материал раунда

```
SHA материала:  2cfb6d21697b8302a7e1e464d38e7f865e4dee88
Дерево:         bb43d120a8a291da4d5a3286956356fbad41bb3d
Ветка:          issue/612-view-config-guards
Validate:       https://github.com/Matysh/houseplan-card/actions/runs/35832762295 (success, headSha сверен)
```

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/612-view-config-guards`, коммит `2cfb6d21697b` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `bb43d120a8a291da4d5a3286956356fbad41bb3d`
  ```
  git log --all --format='%H %T' | grep bb43d120a8a2
  ```
- Тело issue: `4d367d3846753ef46f263b1a4d1a3aeda001b919659b9a650431f3dd4b9c3a45`
- Вердикт конвейера: `green` · High 0
