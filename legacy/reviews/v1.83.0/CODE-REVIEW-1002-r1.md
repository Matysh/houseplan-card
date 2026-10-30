# CODE-REVIEW-1002-r1

Issue: #1002 · Трек: ask · Этап: code · Заход: r1 · блокирующих циклов 0/4
Материал: `f1e08c33802ca9fc2849d65c8562418a9f7e9d29` (ровно эта вершина; рабочая копия уже на нём)

## Скоуп

Делает след робота-пылесоса визуально легче (одна цветная линия 0.9px без
обводки/halo, индивидуальный цвет/alpha на устройство, default `#64B5F6`/0.70)
и переносит согласованную UI Lab-полировку раздела «Пылесос» (статус в одну
строку, компактные карты/калибровка, диагностика-спойлер, независимый Help,
симметричные 18 px). Служит J1/J6 `docs/SCOPE.md` (спатиальный обзор дома и
поддержание плана актуальным) — чисто презентационная правка существующей
функции, без нового job и без выхода за `docs/VACUUM.md` контракт путей/карт.
ТЗ в теле issue содержит §7.1 обязательные разделы, однозначные AC1–AC7 и
способ доказательства каждого; открытых продуктовых вопросов владельцу нет
(раздел «Принято предположительно» закрывает оставшиеся техничес-кие решения).

## Как проверялось

Код прочитан по изменённым файлам (`git diff origin/dev...HEAD`, 48 файлов,
873+/97-): `vacuum-trail-style.ts` (новый), `types.ts`, `validation.py`,
`houseplan-card.ts` (отрисовка path/tip/previousRuns), `houseplan-editor-runtime.ts`
(`_saveMarker` merge latest vacuum), `vacuum-settings-section.ts`,
`vacuum-maps-section.ts`, `hp-color-opacity.ts` (triggerLabel/nativeTooltip),
стили (`devices.styles.ts`, `vacuum-settings.styles.ts`, `dialog-composition.styles.ts`
не менялся — переиспользован из #1007), i18n (4 языка), registries
(`config-field-registry.mjs`, `config-schema.json`, `mutation-registry.mjs`,
`ci-registry-inventory.json`), документация (`VACUUM.md`, `CONFIG-COMPATIBILITY.md`,
`USER-GUIDE.ru.md`, `ARCHITECTURE.md`, оба `CHANGELOG`), release ledger.

Прочитаны оба обновлённых golden-baseline PNG (`vacuum-trail-smoothing-dark`,
`isometric-stage3-overlays-dark`) до/после через `git show origin/dev:... `
vs `HEAD:...` — глазами: было чёрный halo (rgba(0,0,0,.4) 2.25) + белое ядро
(rgba(255,255,255,.82) 0.9), стало одна голубая линия `#64B5F6` без контура,
в Flat и в 2.5D — визуально соответствует AC1/запросу владельца.

Прочитан weekly handoff-комментарий автора в issue (22:59, tip f1e08c338) с
таблицей «AC · доказано · чем краснеет» и перечнем «НЕ сделано» — сверен с
кодом ниже, а не принят на слово.

## Гейты

| Гейт | Результат | Источник |
|---|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build`+bundle-policy | подтверждено | Validate на `f1e08c338`, run [39691304670](https://github.com/Matysh/houseplan-card/actions/runs/39691304670) — success |
| Backend pytest (включая HA harness) | подтверждено | тот же run, job «Бэкенд: pytest в Home Assistant» — success (запущен, т.к. изменён `validation.py`) |
| Golden против эталонов | подтверждено CI + лично просмотрено | тот же run, job «Golden-кадры против принятых эталонов» — success; это единственные 2 сцены с `vacuum` (`demo/golden/matrix.mjs`/`harness.mjs` grep), совпадает с авторским «2 replaced / 218 kept» |
| `node --test test/vacuum-trail-style.test.mjs test/i18n.test.mjs` | прогнано мной локально | 31/31 PASS (после `tsc -p tsconfig.test.json` + `fix-test-build.mjs`) |
| `npm run build` + `node scripts/bundle-sync.mjs` | прогнано мной локально | success, нужно было для браузерных смоков ниже |
| `demo/smoke_vacuum_style_1002.mjs` (зарегистрированная связь smoke-select) | прогнано мной локально | OK, все 13 проверок true (no casing, accepted ink `rgb(100,181,246)`/0.7/0.9px/non-scaling-stroke в view/kiosk×flat/iso, geometry неизменна при pan/zoom, legacy map id `m2` в диагностике) |
| `demo/smoke_vacuum.mjs` (зарегистрированная связь) | прогнано мной локально | OK |
| `demo/smoke_vacuum_dock_restart.mjs`, `smoke_vacuum_multifloor.mjs`, `smoke_vacuum_path_fidelity.mjs` (названы в ТЗ §7 «План команд») | прогнано мной локально | все OK |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | прогнано мной | подтвердил ровно `smoke_vacuum_style_1002.mjs`/`smoke_vacuum.mjs` как «зарегистрированная связь» (остальные — широкие совпадения на общие символы типа `_markerDialog`, не относятся к этой правке) |
| Мутанты из реестра (`vacuum-trail-scaling-stroke-1002`, `vacuum-trail-alpha-string-1002`, `vacuum-legacy-map-diagnostics-1002`) | НЕ исполнялись (запрещено вне ночи) | зарегистрированы в `scripts/mutation-registry.mjs` с `guard`/`because`, статически присутствуют — подтверждено чтением |
| `demo/ui-lab/verify-vacuum-1002.mjs` (authentic HA runtime) | НЕ прогнано мной | требует `npm run ui-lab:prepare` (скачивание официального HA frontend wheel) — тяжёлая инфраструктурная подготовка вне объёма ревью (`docs/process/REVIEWER.md` «Объём гейтов»: полные/тяжёлые наборы — предрелизный гейт). Автор заявил «6/6 PASS на финальной совместной версии» на этом материале — принято как авторское свидетельство, НЕ как независимо воспроизведённое мной; сценарии скрипта прочитаны построчно и соответствуют заявленным AC1/AC2/AC4/AC5 |
| Инварианты геометрии (`npm run invariants`) | не прогонялись | диф не меняет геометрию/калибровку/квоты (только ink-атрибуты), подтверждено чтением `houseplan-card.ts`/`vacuum-trail-style.ts` — не применимо |
| Полная golden/smoke матрица, ручная dev/GPU-приёмка | не прогонялись | предрелизный гейт (`PROCESS.md` §8); ручная приёмка добровольна (#929) |

## Находки

Нет High. Нет Medium в скоупе. Нет Medium вне скоупа — issue не заводится
(`REVIEW_FINDINGS_POLICY`: mode=issues, но список пуст).

## Что проверено и корректно

- **AC1 (оформление пути).** `devices.styles.ts`: `.case` полностью удалён,
  `.core{stroke:var(--hp-vacuum-trail-color);stroke-opacity:var(--hp-vacuum-trail-opacity);stroke-width:.9}`,
  `non-scaling-stroke` сохранён на `path`/`line`/`polyline`. `g.prev{opacity:.4}`
  умножает уже применённую alpha (не подменяет её) — default previous
  `0.7×0.4=0.28`, как в ТЗ/VACUUM.md. `vacuum-trail-style.ts` — чистый модуль
  без побочных эффектов: `vacuumTrailStyle()` валидирует `#RRGGBB`/`[0,1]` и
  откатывается на дефолт на любом некорректном значении (тест AC1/AC3).
  `houseplan-card.ts` прокидывает `data-vacuum-owner`/`style` на current,
  tip-линии и на каждый `previousRuns` отдельно (раньше — общий список без
  стиля владельца, это и было явной проблемой из тела issue, строка «Предыдущие
  маршруты сейчас собираются в общий список...» — исправлено: `id`/`style`
  добавлены на запись). Порядок current-before-previous, budget и geometry не
  тронуты — диф только добавляет поля в объект, не меняет ветвление.
- **AC2 (транзакция цвета).** Превью — `_markerDialog.vacuumTrail`, читается
  через `previewVacuumTrailStyle(id, vacuum, dlg)` только для `draft.devId===id`,
  никакого `config/set` до общего Save. `_saveMarker` берёт `prevVac` из
  **свежего** `this.host._serverCfg` на момент Save (не снимок открытия
  диалога), поэтому `vacuumTrailWriteFields` не затирает source/routes,
  изменённые отдельной операцией за время диалога (ТЗ §3, подтверждено
  строкой кода `const prevVac = markers.find(...)` после `JSON.parse(JSON.stringify(cfg))`
  от `this.host._serverCfg`). Ошибка Save (генерический catch в
  `_saveMarker`) оставляет `_markerDialog` с `busy:false` — draft жив для
  Retry; существующий паттерн, не новый для этой задачи.
- **AC3 (совместимость).** `validation.py`: `_COLOR = vol.Match(r"\A#[0-9a-fA-F]{6}\Z")`
  (переиспользован, anchored, не ловится на trailing `\n` — проверено явным
  негативным тестом `"#123456\n"`), `trail_opacity` — `_finite_number` +
  `Range(0,1)`, отклоняет bool/строку/NaN/Infinity (тест
  `test_invalid_alpha_rejected`/`test_invalid_color_rejected`, 11 кейсов).
  `tests_backend/test_ha_vacuum_trail_style.py` гоняет настоящий JSON/full-ZIP/
  space-backup round-trip. `config-field-registry.mjs`/`config-schema.json`
  обновлены для обоих полей. Фронтенд-валидатор `color()`/`alpha()` в
  `vacuum-trail-style.ts` зеркалит те же правила (regex без `\A\Z`, но JS `^$`
  без флага `m` не матчит `\n` — проверено отдельно `node -e`).
- **AC4/UI-015 (полировка).** `marker.vacuum_status_inline` рендерится как
  `help` блока `formCard` под заголовком «Пылесос» (одной строкой, подтверждено
  CSS `display:block` на `.hpf-head` вместо стандартного flex). Заголовок
  «Источники и состояние» убран из всех 4 языков, ключ `marker.vacuum_source_state`
  удалён. Цветовая строка — `st('marker.vacuum_trail_color')` + `hp-color-opacity`
  (`triggerLabel`/`nativeTooltip=false` — новые пропы, убирают дублирующий
  `title`) + readout `{hex}·{100-round(opacity*100)}%`, ровно как в ТЗ. 18 px
  ритм и симметрия идут из уже слитого `#1007` (`dialog-composition.styles.ts`,
  не менялся в этом диффе) — переиспользован, не продублирован.
- **AC5 (карты).** `renderVacuumMapsSection` больше не гейтится на `tele`
  (раньше `tele ? renderVacuumMapsSection(...) : nothing`) — диагностика карт
  видна и без текущей телеметрии, это расширение видимости, не регрессия.
  «Одна карта сопоставлена и откалибрована» показывается именно когда
  `routes.length===1 && resolution.kind==='ready'`, где `resolution` —
  **route-level** `resolveRoute({routes,observed,spaceIds})` (не
  source-уровня `VacSourceResolution`, который приходит отдельным параметром
  `sources`) — проверил по имени переменных и месту объявления, путаницы
  нет. Порядковые подписи «Первая карта»/«Карта N» идут по стабильному
  `effectiveRoutes` индексу, не по active/сортировке. Легаси map ID (`m2` без
  явного route) теперь виден в диагностике — ровно то, что чинит
  `vacuum-legacy-map-diagnostics-1002`, подтверждено моим прогоном
  `smoke_vacuum_style_1002.mjs` (`legacyMapIdsInDiagnostics:true`).
- **AC6 (визуальный эталон).** Golden CI (чужой прогон, подтверждён job'ом
  выше) заменил ровно те же 2 сцены, что в авторском отчёте; я лично сверил
  те же 2 PNG попиксельно глазами — визуально совпадает с запросом
  (без halo, один голубой след). Приватный UI Lab архив мне недоступен (как
  и указано в самом ТЗ: «синтетические аналоги... не ложное заявление о
  доступности private архива CI») — синтетическая замена (`verify-vacuum-1002.mjs`,
  `fixture.json`) прочитана построчно и покрывает ink/preview/ACK/disclosure
  assertions, совпадающие с AC1/2/4/5.
- **AC7 (соседние поверхности).** `devices.styles.ts`-диф не трогает квоты/
  geometry/projection; `smoke_vacuum_style_1002.mjs` проверил View/kiosk ×
  Flat/2.5D с pan+zoom — geometry (`d`) неизменна, computed style верный во
  всех 4 комбинациях. de/fr переводы не являются английской заглушкой
  (прочитаны оба файла целиком для новых ключей).
- **Трейлеры/changelog.** Все 10 коммитов несут `Issue: #1002`; каждый
  `User-Visible: yes` коммит (`975d4fb58`, `1663e9aa5`, `94a434a13`, `d4020af2e`)
  правит `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` в этом же коммите.
  `docs/release-ledger/v1.82.0/1002.json`: `category:"major"` с обоснованием —
  соответствует новой пользовательской настройке, отсутствовавшей в
  v1.82.0 stable; `introducedBy` не требуется (это не внутри-бета правка).
- **Одно число — один источник (§8).** `#64B5F6`/`0.70`/`0.9` входят в код
  ровно один раз (`VACUUM_TRAIL_DEFAULT` в `vacuum-trail-style.ts`); readout
  в UI, документация (`VACUUM.md`, `USER-GUIDE.ru.md`, changelog) и тесты все
  цитируют эту же константу текстом, а не независимое магическое число.

## Чего не проверял

- `demo/ui-lab/verify-vacuum-1002.mjs` (authentic real-HA picker/dialog,
  AC2/AC4/AC5 полный матч против приватного стенда) — требует
  `npm run ui-lab:prepare` (сетевая загрузка официального HA frontend wheel):
  тяжёлая инфраструктурная подготовка, вне объёма код-ревью на этом треке.
  Принял заявленный автором результат «6/6 PASS» как авторское свидетельство
  с названной командой, не как воспроизведённое мной; статически прочитал
  сам скрипт и подтвердил, что его assertions соответствуют AC.
- Полная golden/smoke-матрица, perf-смок, native Windows Ecovacs (вынесено в
  отдельный #1009 автором) — предрелизный гейт, не гейт ревью (`PROCESS.md` §8).
- Ручная dev/GPU-приёмка владельцем — добровольна (#929), не требуется и не
  является находкой её отсутствие.
- Инварианты модели (`npm run invariants`) — диф не меняет геометрию/калибровку/
  квоты, только ink-атрибуты; гейт неприменим.
- Визуальное попиксельное сравнение с приватным `accepted-v1.82.0-vacuum-ui012-ui015-20261021`
  архивом — недоступен мне (как и CI, явно оговорено в самом ТЗ).

## Маршрут

`route: fix` (track `ask`, не `show` — критерий reclassify не применяется).

## Вердикт

Зелёный. AC1–AC7 доказаны автотестами и смоками, способными упасть
(подтверждено чтением и собственным прогоном); защитные AC (валидация,
geometry-инвариант отрисовки, legacy-диагностика) имеют таблицу «AC · доказан ·
чем краснеет» с зарегистрированными, не исполнявшимися мутантами плюс обычные
исполненные негативные кейсы. Находок нет.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1002-vacuum-trail-style`, коммит `f1e08c33802c` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `e1bf06841393a71887769bd70439993ce9f7e660`
  ```
  git log --all --format='%H %T' | grep e1bf06841393
  ```
- Тело issue: `40fb10342b6a79d40d4f914f0c555ddeaa9910dcc0bb624646103fbc8588f0c2`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxNjgsIm91dHB1dF90b2tlbnMiOjE5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MjYyOTk5OTk5OTk5OTk5NH0seyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MTk2LCJvdXRwdXRfdG9rZW5zIjo1MjU3MiwiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjoyMTE0NDcsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoxNTA2OTA2NiwiY29zdFVzZEVzdGltYXRlIjo0LjM4NTcxMzE5OTk5OTk5OX1dLCJ0dXJucyI6MTA4LCJkdXJhdGlvbk1zIjo3NDkwNzcsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjo0LjM5MDk3NjE5OTk5OTk5OSwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5364 output_tokens=52591 cache_creation_input_tokens=211447 cache_read_input_tokens=15069066 num_turns=108 -->
