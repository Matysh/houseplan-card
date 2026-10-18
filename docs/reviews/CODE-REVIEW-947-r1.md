# CODE-REVIEW-947-r1

Issue: #947 «Настройки устройства: финальный UX общих и профильных разделов».
Трек: ask. Заход: r1 (код-ревью, первый). Блокирующих циклов на этапе `code`
израсходовано 0 из 4 до этого вердикта. Материал: `ecbb1e520a63cbef0fe6033d270dfd2643cdfc4b`
(рабочая копия на нём), база `origin/dev` = `77aa74fbde3f2def7174541c9c86db6a7afbb9c4`.
ТЗ принято арбитражем владельца 2026-10-18 после исчерпания spec-бюджета (4/4),
см. `docs/reviews/SPEC-REVIEW-947-r5.md` и комментарии issue от 18.10.2026
16:20–18:53. Этот документ разбирает реализацию целиком (не дельту — это первый
код-ревью раунд).

## Скоуп

Редизайн диалога настроек устройства (`src/editors/marker-dialog.ts`) на пять
общих разделов (Основное / Отображение на плане / Действия и связи / Свет и
свечение / Сведения) + условные профильные вкладки (Пылесос, Радар —
только для автоматически распознанного LD2450). Сопутствующие изменения:
вынесение `vacuum-settings-section.ts` из `houseplan-editor-runtime.ts`,
правка `radar-editor.ts`/`radar-section.ts` (разделение hardware-признания
`recognizeRadarBinding` и совместимости сохранённых профилей `recognizeRadar`),
`hp-device-preview.ts` (фиксированный scale=1), i18n (4×~42 новых ключа +
dead-key cleanup), golden-баseline (7 сцен), bundle-budget (+4658 B
обоснованно), release-ledger `v1.81.0/947.json`, mutation-registry (+5 witness,
только регистрация), полная актуализация `docs/RADAR.md`, `docs/USER-GUIDE.md`,
`docs/USER-GUIDE.ru.md` по арбитражному требованию владельца.

## Как проверялось

Чтение диффа `git diff origin/dev...HEAD` по подсистемам (75 файлов), частично
распараллелено через 4 фоновых агента (marker-dialog/radar-toggle; preview и
общие контролы; документация; i18n/тесты) — каждый отчёт перепроверен выборочно
чтением исходников самим ревьюером, один найденный агентом нюанс (поведение
«Remove» в legacy-панели) верифицирован самостоятельно построчно в
`src/editors/radar-section.ts` и `src/editors/marker-dialog.ts`, включая
сравнение с версией файла на `origin/dev` (`git show origin/dev:src/editors/radar-section.ts`),
и подтверждён отсутствием соответствующего теста в `demo/smoke_radar_setup.mjs`.

### Гейты

| Гейт | Результат | Источник |
|---|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build` + `bundle-policy --verify` | не перегонялись повторно | зелёный Validate на точном SHA `ecbb1e52`: https://github.com/Matysh/houseplan-card/actions/runs/39156159175 (подтверждено автором в handoff) |
| `golden:verify` (`ci:golden` на задаче) | принято | коммит `ecbb1e52` «accept reviewed settings dialog scenes», `Baseline-Reviewed-Local: sha256:d8fd6d7a…`, затрагивает ровно 7 объявленных сцен (`device-dialog-*`, `toggle-entity-dialog-*`, `device-help-popover-light-ru`, `device-ripple-color-popover-mobile-ru`), индекс/остальные 205 сцен не менялись |
| smoke, относящиеся к диффу | не перегонялись ревьюером; приняты как разобранные чтением | `demo/smoke_device_settings_947.mjs`, `demo/smoke_radar_setup.mjs`, `demo/smoke_settings_native_select_947.mjs`, `demo/smoke_climate_temp.mjs`, `demo/smoke_vacuum_firstuse.mjs` и прочие из diffstat прочитаны построчно; автор заявляет PASS по каждому в handoff-комментарии (конкретные команды названы) |
| `pytest tests_backend` | не прогонялся | диффа в `custom_components/**`/Python нет (подтверждено `git diff --stat`); unchanged backend наследует зелёный CI родительской #946 |
| `npm run invariants` | не прогонялся | диффа геометрии/модели плана нет — только presentation-слой (preview scale, вкладки формы); канон (`docs/DEVICE-PRESENTATION.md`) явно фиксирует «This editor-only normalization does not change plan/static/kiosk geometry» |
| мутанты (исполнение) | не запускались и не должны были | политика: мутанты — только ночной прогон; 5 новых `*-947` witness в `scripts/mutation-registry.mjs` зарегистрированы (static), `caught=unknown`, честно заявлено автором |

Чего не проверял: не запускал браузер самостоятельно (ни smoke, ни golden,
ни dev-сервер) — положился на зелёный Validate этого SHA и на построчное чтение
тестовых файлов с проверкой, что заявленные ассерты действительно присутствуют
и логически бьют нужный негативный случай (см. ниже). Не проверял визуально
сами PNG-пары (`docs/design/settings-dialogs-944/device-implementation-evidence/*.png`)
— доверился их присутствию, размеру и описанию в README/evidence.json.
Полный предрелизный набор (вся golden-матрица, вся smoke-матрица, Windows
toolchain) не прогонял — это гейт релиза, не гейт код-ревью (PROCESS §8).

## Находки

### Medium (в скоупе) — потеря возможности отменить «Remove» у устаревшего
radar-профиля в той же сессии диалога

**Файлы:** `src/editors/radar-section.ts:100,125`, `src/editors/marker-dialog.ts:818,865-866`.

Для устройства с уже сохранённым (валидным v1-форматом — `cartesian_v1`,
`polar_v1`, `zones_v1`, `presence_v1`, т.е. любым из пяти «старых ручных»
профилей из `docs/RADAR.md`) `marker.radar`, но НЕ проходящего текущее
аппаратное распознавание LD2450 (`recognizeRadarBinding(...).eligible === false`),
путь совместимости в разделе «Сведения» работает так:

1. Виден предупреждающий callout + ссылка «Открыть предыдущие настройки радара»
   (`legacyRadar = !automaticRadar && !d.radarRemove && !!persistedMarker?.radar`,
   `marker-dialog.ts:818`).
2. По клику открывается полноценная форма радара через
   `this._renderRadarSection(d, radarDevice, 'additional')` — ожидаемо, это и
   есть путь совместимости, который требует ТЗ.
3. Внутри этой формы есть кнопка «Удалить» (`remove()` в `radar-section.ts:74-78`,
   с комментарием в самом коде, сохранённым без изменений от версии на
   `origin/dev`: *«Turning the switch back on in the same session must restore
   every entered source/calibration value»*). Клик ставит `d.radarRemove = true`.
4. После этого на следующем рендере `legacyRadar` в `marker-dialog.ts:818`
   становится `false` (требует `!d.radarRemove`) — **весь callout и вся форма
   исчезают из «Сведений»**. В `radar-section.ts:125`
   (`if (!active) return automatic ? formCard(...) : html\`\`;`) для
   `automatic === false` возвращается пустой шаблон — там же раньше (на
   `origin/dev`, та же строка) стоял `return html\`<div class="radaradditional">${radarToggle}</div>\`;`,
   то есть тумблер **всегда** оставался на экране и позволял включить радар
   обратно немедленно (`restoreOrBegin()`), восстанавливая весь черновик. В
   новой версии `radarToggle` вообще не рендерится для `automatic === false`
   (`radar-section.ts:100`: `automatic ? toggleRow(...) : nothing`).

**Чем краснеет:** воспроизводится чтением (не исполнялся как мутант). Повторяю
шаги 1–4 мысленно по коду: после клика «Удалить» пользователь не видит больше
ни предупреждения, ни кнопки восстановить — единственный путь назад: Cancel,
что отбрасывает **весь** черновик диалога (включая любые другие несохранённые
правки на других вкладках), затем переоткрыть устройство заново. Сами
сохранённые данные на бэкенде не теряются (Save не вызывается), поэтому это не
потеря данных, но это прямая регрессия возможности («доступность через путь
совместимости»), которую AC5 явно требует («прежние ручные данные работают и
доступны через путь совместимости»), и которую сам код обещает в неизменённом
комментарии. Эта же область — High-risk по истории пяти раундов spec-review
этого issue (#947, ранее трижды возвращавшийся именно по radar-совместимости).

Тестовое покрытие этот случай не ловит: `demo/smoke_radar_setup.mjs` раньше
(на `origin/dev`) использовал переменную `ordinary` для НЕ распознанного
устройства (`d_lamp`-подобное) именно для этого класса проверок; в текущем
диффе та же переменная `ordinary` переопределена на новый `radar947` —
**аппаратно распознанный** LD2450-фикстурой (строки 15-21 того же файла), и
assert'ы `savedOffKeepsOriginal`/`savedOnRestoresOriginal` (строки 135-140)
теперь проверяют toggle-restore только для recognized-устройства (где
`automatic === true`, код исправен). Отдельный легаси-фикстур `m_radar`
(`binding: device:d_motion`, нераспознанный) в блоке `out774` открывается через
новый `openSavedRadar()` (строки добавлены в этом диффе) и тестирует
calibration/Cancel/reopen, но нигде не кликает кнопку «Удалить» для этого
устройства — поэтому регрессия осталась незамеченной.

Предлагаемое направление правки (не обязывает автора к конкретной реализации):
либо держать `radarToggle`/панель видимой независимо от `active` для
legacy-случая (как было на `origin/dev`), либо явно показывать отдельное
«отменить удаление» состояние вместо полного исчезновения.

### Low (снят ревьюером с записью) — задвоенный абзац футера в английском гайде

**Файл:** `docs/USER-GUIDE.md:1376-1378`.

Новый абзац про футер диалога добавлен этим диффом на строках 1354-1358
(«The footer keeps **Hide / Delete** on the left and **Cancel / Save**…»).
Сразу после таблицы полей (строка 1375) остался нетронутый диффом старый абзац
с тем же смыслом другими словами («The footer keeps **Hide** and **Delete** on
the left and **Cancel**/**Save**…», строки 1376-1378) — редакционный дубль, не
содержит неверных фактов и не описывает убранную функциональность, поэтому не
блокирует. Параллельного дубля в `docs/USER-GUIDE.ru.md` нет (там после таблицы
сразу следует новый `###`-заголовок). Не блокирует вердикт; стоит убрать при
следующей правке этого файла.

## Что проверено и корректно

- **Удаление ручного тумблера «Это радар присутствия» для новых деклараций** —
  подтверждено чтением. `recognizeRadarBinding` (`src/radar-editor.ts:119-135`)
  — чисто аппаратная проверка (LD2450 + target1 X/Y), не смотрит на
  `marker.radar`; именно она, а не `recognizeRadar`, гейтит и вкладку
  `radar` в основном наборе разделов (`marker-dialog.ts:813,890`), и рендер
  тумблера внутри `radar-section.ts:70,100`. Ни одного оставшегося пути
  объявить новый радар для нераспознанного устройства не нашёл ни один из
  проверяющих (3 независимых прохода по `marker-dialog.ts`/`radar-section.ts`).
  Строка/ключ `radar.declare` полностью удалены из кода и всех четырёх локалей
  (i18n-агент подтвердил отсутствие ссылок).
- **`marker.hide_signal`** — не тронут по модели/схеме; переключатель
  `hideSignal` в разделе «Отображение на плане» сразу после `hideBattery`
  (`marker-dialog.ts:632-643`), state plumbing
  (`houseplan-editor-runtime.ts:7262,7606`) не изменён этим диффом, backend
  roundtrip из #867 переиспользуется как регрессия (без нового Python-кода).
- **AC3 (preview)** — `hp-device-preview.ts:189-192`: `scale` жёстко
  зафиксирован в `1` до любой раскладки; убраны прежние `fit`/`fitPct` и
  уведомление «уменьшено до N%» (ключ `marker.preview.scaled` удалён отовсюду,
  включая локали). Поворот применяется только к `<ha-icon>`
  (`src/device-face.ts:132`), не к бейджу/значению — не тронут этим диффом.
  `docs/DEVICE-PRESENTATION.md:491` зафиксировал это как канон в том же
  коммите. `smoke_device_settings_947.mjs` включает прямые негативные проверки
  `size_does_not_change_preview`, `rotation_changes_only_icon`,
  `unavailable_stays_dash`, `no_fit_notice`.
- **AC6 (границы операций пылесоса/радара)** — `vacuum-settings-section.ts`
  побайтово (по логике) эквивалентен вынесенному блоку
  `houseplan-editor-runtime.ts` (тот же `setVac`, те же вызовы
  `_vacEnsureMarker`/`_saveConfig`/`_vacAutoCalibrate`/`_vacStartFit`/
  `_vacOpenAllCameras`), сменилась только разметка. Guard радара на Save/Hide/
  Delete во время wizard (`this._radarSetup.isActive()`) не тронут
  (`marker-dialog.ts:173,898,911`). `radius_filled_but_not_materialized` в
  smoke подтверждает, что отображение унаследованного радиуса не пишет
  override.
- **AC7 (тема/mobile/MDI)** — все новые CSS-правила в
  `settings-dialogs.styles.ts` используют `var(--hpf-*)`/HA-токены, ни одного
  нового хардкод-цвета. Медиа-блок 320/390px и таймингов 150/160ms в
  `hp-settings-select.ts`/`form-kit.styles.ts` не изменён этим диффом и не
  сломан. Реальный MDI-picker переиспользован без замены, кнопка «восстановить
  иконку» нигде не осталась (grep по всему репозиторию).
- **Документация (RADAR.md, USER-GUIDE.md, USER-GUIDE.ru.md)** — полностью
  соответствует арбитражному требованию владельца от 18.10.2026: ни «Additional
  actions»/«Дополнительные действия», ни «This is a presence radar»/«Это радар
  присутствия», ни «Use the manual action for a custom real device» не остались
  нигде в этих трёх документах (grep по всему файлу, не только по диффу).
  Разделы «Marker basics»/«Основные настройки маркера» переписаны под новые
  пять разделов; карточка «Appearance»/«Внешний вид» для заряда/Zigbee
  переименована в «Display on plan»/«Отображение на плане» (её прежнее имя в
  обоих гайдах теперь относится только к несвязанному разделу настроек
  Space/2.5D). `docs/RADAR.md` Troubleshooting переписан без ссылки на ручное
  действие, с объяснением «Stop versus remove» и путём через Details.
- **i18n** — 4 локали `src/i18n/settings/*.json` содержат идентичный набор
  новых ключей (280/280), `src/i18n/*.json` синхронно теряют одинаковые 18
  мёртвых ключей во всех четырёх локалях; grep по `src/`/`test/`/`demo/`
  подтверждает отсутствие остаточных ссылок. `test/i18n.test.mjs` сохраняет
  полную проверку соответствия ключей между локалями.
- **Трейлеры и changelog** — каждый непустой класс-A/B коммит несёт `Issue:
  #947` и корректный `User-Visible:`; все `User-Visible: yes` коммиты правят
  `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` в том же коммите (проверено по
  всем 9 таким коммитам). D-коммит `ecbb1e52` несёт `Release:
  v1.82.0-beta.1` + `Baseline-Reviewed-Local: sha256:…`, совпадает с текущей
  версией в `package.json`/`manifest.json`.
- **release-ledger** — `docs/release-ledger/v1.81.0/947.json`: `category:
  "major"`, формат идентичен соседям (#945, #946), обоснование соответствует
  содержанию фичи; `introducedBy` не требуется — это не внутрибетный фикс, а
  исходная реализация новой беты.
- **Bundle budget** — `scripts/monolith-baseline.json`/`bundle-budget.mjs`
  обновлены ровно на измеренный факт (+4658 B raw, в рамках полосы 2000 B по
  gzip-метрикам); прогрессия по коммитам (`b4a29a8a` → `5eff4898`) совпадает
  с описанием в issue/DEVELOPMENT.md.

## Чего не проверял (кратко)

- Не запускал браузер/Playwright сам; гейты tsc/test/build/golden приняты по
  зелёному Validate на точном SHA и по построчному чтению тестов/кода, а не по
  собственному исполнению.
- Не проверял Python/backend — диффа там нет.
- Не проверял геометрию/инварианты плана — диффа геометрии нет, только
  presentation-слой диалога.
- Не проверял визуально сами PNG-скриншоты (golden, evidence pairs) пиксель в
  пиксель — положился на их наличие, affected-scene list и числовые/хеш-пруфы
  автора.
- Полная ночная мутационная матрица не прогонялась и не должна была (вне
  ночного workflow).

## Вердикт

Один Medium-дефект в скоупе (путь совместимости для старых ручных radar-
профилей теряет возможность отмены «Удалить» в рамках той же сессии диалога,
хотя сам код обещает это в неизменённом комментарии, а область прямо названа
High-risk в истории issue) — достаточно для жёлтого вердикта и возврата
автору; High-находок нет.

`route: fix`.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/947-device-settings`, коммит `ecbb1e520a63` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `a7fb35d068ded90d961ab80299ce504b1c4a7523`
  ```
  git log --all --format='%H %T' | grep a7fb35d068de
  ```
- Тело issue: `a3d9a3e96733c14d016336d076da0b5768fca7c8fb75c2b9ff7377ddc51db350`
- Вердикт конвейера: `yellow` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxMjMsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MjEzfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjozMTAsIm91dHB1dF90b2tlbnMiOjg4NTQzLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjQyOTQzOSwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjEzMDAwMTE0LCJjb3N0VXNkRXN0aW1hdGUiOjQuODM3NjgzM31dLCJ0dXJucyI6NjksImR1cmF0aW9uTXMiOjUzNjUwNCwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjQuODQyODk2MywiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5433 output_tokens=88561 cache_creation_input_tokens=429439 cache_read_input_tokens=13000114 num_turns=69 -->
