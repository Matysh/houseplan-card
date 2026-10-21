# CODE-REVIEW-948-r1

**Issue:** #948 · **Этап:** code · **Трек:** ask · **Заход:** r1 · блокирующих циклов израсходовано 0 из 4 (до этого вердикта)
**Материал:** `origin/dev...HEAD`, вершина `68735d366025990de3c76af50583ba593ffe955a` (рабочая копия на этом SHA, не переключался)
**Коммиты в материале:** 3cbe8b23 (docs), a265fa08, 65e94aea, 97ea12d4, 768fd31f, c063215c, 68735d36 — все 6 несущих кода/тестов несут `Issue: #948`; три `User-Visible: yes` (a265fa08, 65e94aea, 768fd31f) правят `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` в том же коммите — проверено построчно, расхождений нет.
**Policy snapshot:** `{"schema":"houseplan-outside-findings-policy/v1","mode":"issues",...}` — побочные находки вне скоупа заводятся отдельным issue; в этом раунде побочных находок вне скоупа не обнаружено, всё найденное относится к предмету задачи #948 (General settings redesign).

## Скоуп

Редизайн диалога «Общие настройки» (J4/J6/J5/J7 по `docs/SCOPE.md`): шесть разделов вместо семи плоских карточек, компас севера, единый color+opacity picker, диагностика Zigbee с автоопределением ZHA/Z2M, четыре превью фона, общий `hp-settings-select` для select-ов диалогов настроек. Класс изменений A (`src/**`, i18n) + B (`demo/**`, `scripts/**`, тесты) + D (golden baselines, с `Release:`/`Baseline-Reviewed-Local` трейлерами на c063215c). 92 файла, +6225/-536.

## Как проверялось

| Гейт | Статус | Комментарий |
|---|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build` + bundle-policy | **не перегонял** | Validate на `68735d36` зелёный (https://github.com/Matysh/houseplan-card/actions/runs/39100970771) — дешёвые гейты приняты по ссылке, п.8 |
| `node scripts/smoke-select.mjs` | не запускал команду, но сверил `scripts/smoke-links.mjs` вручную: диф добавляет `smoke_settings_select.mjs` (связан с `hp-settings-select.ts`/`settings-styles.ts`/`form-kit.ts`) и `smoke_settings_navigation.mjs` (связан с `settings-dialogs.styles.ts`/`settings-sections.ts`/`settings-north.ts`) | прямое совпадение файл→smoke, не НЕОПРЕДЕЛЁННОСТЬ |
| `golden:verify` | не прогонял | метка `ci:golden` есть; baseline-коммит c063215c несёт `Release:`+`Baseline-Reviewed-Local:sha256:...` — автор уже прогнал и приложил локальное визуальное свидетельство по PROCESS §10.1; не переисполнял |
| `npm run invariants` | не применим | геометрия плана/комнат не меняется, правка — форма настроек |
| `pytest tests_backend` | не применим | серверный контракт не менялся (integration-provider — чисто клиентский WS-кэш) |
| Чтение диффа | выполнено по всем 92 файлам, глубоко — по файлам из риск-блока и `general-settings-dialog.ts`, `hp-zigbee-topology-settings.ts`, `zigbee-integration-presence.ts`, `settings-sections.ts`, `hp-settings-select.ts`, `settings-north.ts`, `hp-dialog.ts`, `settings-dialogs.styles.ts`, тесты/смоки | |
| Проверка через 4 параллельных агента | touch (settings-north.ts pointer), devices (integration-provider.ts), perf (hp-settings-select.ts/settings-sections.ts), ux/i18n (hp-settings-select.ts vs «Общие состояния», i18n-ключи settings/*) | каждый отчёт перепроверен мной построчно по коду, часть выводов скорректирована (см. находки) |
| i18n key-parity (settings/*.json en/de/fr/ru) | выполнено вручную (`jq`-эквивалент через node), плюс прочитан существующий `test/i18n.test.mjs` (строки 121-150) | ключи `src/i18n/{code}.json` и `support/*` проверяются штатным тестом на совпадение множества ключей; для `src/i18n/settings/*.json` такого теста нет — сейчас расхождений нет (проверено), но инвариант на будущее ничем не закреплён |

## Риск по изменённым участкам (трек ask — сверка с AC ТЗ)

| Класс | Участок | Покрытие ТЗ | Вывод |
|---|---|---|---|
| **touch** | `settings-north.ts` pointerdown/move/up, setPointerCapture | §8 «Север»: «числовое поле обеспечивает альтернативу взаимодействию мышью» — явно закладывает интерактивный (мышиный) компас с числовой альтернативой; Pointer Events унифицируют mouse/touch. `docs/TOUCH-SUPPORT.md` + `docs/SCOPE.md`: редакторы desktop-first, touch — best effort | Новый код (в `origin/dev` компас был статичной `.hpf-north` без drag). `touch-action:none` на `.hpf-north-dial` уже стоит (`settings-dialogs.styles.ts:52`) — блокировки скролла при драге нет. `pointercancel` не обрабатывается явно, но оба хендлера гейтятся через `hasPointerCapture`, которую браузер сам снимает при cancel — зависшего состояния не возникает. Автотеста именно pointer-драга нет (есть тест клавиатуры/числа/слайдера/рендер-размера). Покрыто адекватно по политике best-effort; **Low**, не блокирует |
| **devices** | `integration-provider.ts:78,175` (`entriesAvailable`) | §9 «Автоопределение»: «ZHA считать настроенной по надёжным сведениям... отличать игнорируемую запись от настроенной, но отключённой»; «пустой успешный ответ и ошибка запроса — разные результаты» | `entriesAvailable` корректно разводит «успешный пустой ответ» и «ошибка запроса» (используется в `zigbee-integration-presence.ts` для `unknown` vs `absent`). **Но** `zigbeeIntegrationPresence` не фильтрует `entry.source === 'ignore'` — см. находку №1 ниже. Класс покрыт ТЗ, но реализация не выполняет один явно процитированный пункт |
| **perf** | `hp-settings-select.ts` (MutationObserver, resize/scroll/pointerdown листенеры), `settings-sections.ts:67` (RAF), `settings-north.ts:12` (getBoundingClientRect в pointermove) | Явного perf-AC нет; раздел «Общие состояния» и `docs/ARCHITECTURE.md` требуют ленивый editor-граф | `disconnectedCallback` симметрично снимает всё, что добавляет `open()` (подтверждено построчно). RAF — одноразовый вызов для forced-reflow перед transition/скроллом, не цикл. `getBoundingClientRect` в компасе — один read на `pointermove`, только пока активен drag одного элемента. `scripts/bundle-budget.mjs` явно учитывает стоимость нового кода (+5758 Б / +2815 Б gzip) в `LAZY_EDITOR_GZIP_CEILING`, View-чанк не растёт (−407 Б). Адекватно покрыто, находок нет |
| **ux** | `hp-settings-select.ts:193` (customElements.define), ~104 новых i18n-ключей | Раздел «Общие состояния интерактивных элементов — уточнение 17.10.2026» прямо описывает этот select (анимация 160мс, клавиатура, fallback без Popover) и прямо разрешает: «первая задача #948 вводит общий слой, последующие подключают его без копирования» — новый общий компонент **санкционирован**, это не «демонстрационный контрол прототипа» | i18n: ключи `settings/*.json` идентичны по набору en/de/fr/ru (проверено), различие в diffstat fr.json — только побочное переформатирование старого блока в en/de/ru, не пропущенный перевод. Компонент: hover/active переход options отсутствует (см. находку №2). Клавиатура/фокус/reduced-motion/fallback-портал реализованы и покрыты `smoke_settings_select.mjs` построчно по тексту требования — **не подтвердился** вывод одного из агентов «тестов нет вообще»: `demo/smoke_settings_select.mjs` (новый файл в этом диффе) проверяет именно открытие/закрытие/анимацию/клавиатуру/фокус/fallback/живую тему/reduced-motion этого компонента |

Маршрут по §5 (`reclassify`) к этому вердикту не относится: трек — `ask`, а не `show`; `route` зафиксирован как `fix`.

## Находки

### 1. Medium — автоопределение ZHA не отличает игнорируемую запись от настроенной (devices, §9 ТЗ)
`src/zigbee-integration-presence.ts`:
```js
const zha = entries.some(entry => entry.domain === 'zha') || entities.some(entity => entity.platform === 'zha');
```
ТЗ (раздел «Автоопределение и ручной fallback»): «ZHA считать настроенной по надёжным сведениям конфигурации HA; отличать игнорируемую запись от настроенной, но отключённой/не загрузившейся». HA возвращает в `config_entries/get` и записи, созданные пользователем через «Игнорировать» на discovery-подсказке (`source: 'ignore'`, запись без реально работающей интеграции). `loadMetadata` (`integration-provider.ts:76-81`) кладёт в кэш все записи с `domain==='zha'` без фильтра по `source`, а `zhа`-проверка выше не исключает `entry.source === 'ignore'`.
**Чем краснеет:** обычный негативный тест — `test/settings-sections.test.mjs`, тест `'#948 ZHA-only discovery, both integrations, and generic MQTT stay distinct'` не содержит записи с `source:'ignore'`; сценарий не исполнялся ни в одном тесте (grep по `ignore` в `test/settings-sections.test.mjs` и `src/zigbee-integration-presence.ts` — 0 совпадений). Воспроизведение: пользователь один раз отклонил ZHA-discovery в HA → `config_entries/get` вернёт игнорируемую запись `domain:'zha'` → диагностика покажет «ZHA настроена», блок ZHA выйдет из-под `<details>` ручного fallback, хотя реальной интеграции нет — прямое нарушение процитированного пункта ТЗ.
**Статус:** в скоупе, возвращается автору.

### 2. Medium — две независимые кнопки отмены одновременно (§10 ТЗ, AC14)
`src/editors/general-settings-dialog.ts`, раздел «Резервные копии и обслуживание»:
```js
${host._canOptimizeUndo && host._undoKind === 'import' ? html`
  <button ...>${st('backup.undo_import')}</button>` : nothing}
...
<button ?disabled=${!host._canOptimizeUndo || host._undoKind === 'import' || ...}>
  ${st('gs.optimize_undo')}
</button>
```
Вторая кнопка («Отменить последнюю оптимизацию») теперь рендерится **безусловно** (раньше была под `host._canOptimizeUndo && host._undoKind !== 'import' ? ... : nothing`), лишь получая `disabled`. ТЗ: «если последней был полный импорт, **вместо** отмены оптимизации показывается... «Отменить последний полный импорт»... Не показывать две независимые отмены, когда история поддерживает только одну». При `canOptimizeUndo=true, undoKind='import'` пользователь одновременно видит активную «Отменить последний полный импорт» (в блоке импорта/экспорта) и неактивную, но видимую «Отменить последнюю оптимизацию» (в блоке обслуживания) — ровно те «две независимые отмены», которые ТЗ просит не показывать.
**Чем краснеет:** негативного автотеста/мутанта на эту комбинацию состояний нет. `demo/smoke_optimize_context.mjs` кликает `button:has(ha-icon[icon="mdi:undo-variant"])` только в сценариях с `undoKind==='optimize'` (там второй кнопки нет и неоднозначности не возникает); сценарий `undoKind==='import' && canOptimizeUndo===true` при открытом разделе «Данные» ни одним смоком/тестом не инсценирован — третий столбец «чем краснеет» пуст.
**Статус:** в скоупе, возвращается автору.

### 3. Medium — у опций `hp-settings-select` нет анимированного hover/active-перехода (ux, уточнение 17.10.2026)
`src/hp-settings-select.ts`:
```css
[role=option] { ...; cursor:pointer; overflow-wrap:anywhere; }
[role=option].active,[role=option]:hover { background:...; }
```
Ни у `[role=option]`, ни у правила `.active/:hover` нет `transition`. Раздел «Общие состояния интерактивных элементов — уточнение 17.10.2026» (датирован днём перед реализацией, относится ко всем диалогам): «Доступные кнопки, **списки** и ссылки: `cursor: pointer`, заметный hover с переходом 160 мс». Сам контейнер меню анимирован (`opacity`/`transform` 160 мс — проверено в `smoke_settings_select.mjs`), а подсветка конкретного пункта внутри списка переключается мгновенно, без перехода — именно то, что уточнение требует для «списков».
**Чем краснеет:** нет теста, проверяющего `transitionDuration` для `[role=option]` (grep `role=option` по `demo/smoke_settings_select.mjs` — совпадений нет; тест проверяет только контейнер `.menu`). Негативный сценарий не исполнялся.
**Статус:** в скоупе, возвращается автору. (Низкая визуальная значимость, но явно процитированное и недавнее требование — не снимаю сам.)

### Low / к сведению (не блокируют, записаны для автора)

- **Геометрия вразрез с таблицей v6** (раздел «Размеры и оформление эталона»): скругление диалога — `13 px` в таблице, фактически `hp-dialog[settings-layout]` не переопределяет `--rad-l`/`--ha-dialog-border-radius`, диалог остаётся на общем `18px` (`hp-dialog.ts:66,188`). Брейкпоинт узкой версии — «550 px и меньше» в таблице, в коде `@media(max-width:600px)` (`settings-dialogs.styles.ts`). Оба значения не покрыты существующими мобильными смоками (которые бьют по 320/390px, ниже обеих границ), так что расхождение не всплывает ни в одном прогоне.
- **Текст компаса неполон**: `gs.north_description` = «Направление на север помогает правильно показать лучи из окон. 0° — вверх плана, угол отсчитывается по часовой стрелке» — пропущено «90° — вправо» из процитированного в §8 текста («0° — вверх плана, 90° — вправо. Угол отсчитывается по часовой стрелке»).
- **Схема начала лучей не подписана «выбрано»**: §8 «Начало оконных лучей»: «Выбранная схема выделена **и подписана «выбрано»**». `sun-settings-view.ts`/`settings-dialogs.styles.ts` дают только `.is-selected { border-color: var(--hpf-accent) }` — визуальное выделение есть, текстовой подписи «выбрано» нет нигде (ни в `figcaption`, ни в aria).
- **Ссылка конвертера без слэша**: ТЗ цитирует `https://houseplan.tech/convert/`; код — `href="https://houseplan.tech/convert"` (без слэша). Работоспособность конечного URL не проверялась (внешний сайт, сеть недоступна и нерелевантна для код-ревью) — отмечаю для подтверждения автором/владельцем, что редирект настроен, раз AC14 требует «рабочую ссылку».

## Что проверено и корректно

- Трейлеры `Issue:`/`User-Visible:` на всех некоммитах-доках; changelog RU/EN правлен в тех же коммитах, что и `User-Visible: yes`; `docs/release-ledger/v1.81.0/948.json` классифицирует изменение как `major` с обоснованием (видимый редизайн рабочего процесса) — решение автора, согласуется с масштабом правки.
- `settings-sections.ts`: все панели остаются смонтированными (`?hidden`, не условный рендер) — навигация между разделами не теряет DOM-узлы/фокус/черновик, что прямо требует §2 ТЗ; подтверждено тестом `settings-sections.test.mjs` и смоком `smoke_settings_navigation.mjs` (`navigationKeepsMountedDraft`).
- `zigbeeIntegrationPresence`: корректно разводит `unknown`/`absent`/`present`, не считает отсутствие discovery доказательством отсутствия Z2M, не требует MQTT-записи без реального моста — всё, кроме пункта №1 выше, покрыто unit-тестом с настоящими негативными сценариями (fetch failure → unknown, MQTT-only → z2m unknown, добавление bridge-устройства → present).
- `hp-settings-select.ts`: `MutationObserver` и все window/document-листенеры симметрично снимаются в `close()`/`disconnectedCallback()`; `requestAnimationFrame` — одноразовые вызовы, не циклы; `LAZY_EDITOR_GZIP_CEILING` поднят с явным обоснованием измеренной стоимости, View-чанк не вырос — компонент остаётся в ленивом editor-графе (`docs/ARCHITECTURE.md` обновлён тем же диффом).
- Геометрия, совпавшая точно: ширина диалога 610px, шестерёнка 40.48px, close-hover rotate(90deg) scale(1.12) 160ms, keyboard navigation/typeahead/Home/End в `hp-settings-select`, `touch-action:none` на компасе.
- `settings-north.ts` — новый код (в `origin/dev` компаса с drag не было), не регрессия существующего поведения; числовой ввод остаётся полноценной alternative-точкой входа, синхронизирован с компасом и слайдером (AC5, проверено тестом/смоком).
- i18n: ключи `settings/*.json` идентичны по набору во всех 4 локалях на момент ревью (проверено вручную); существующий `i18n.test.mjs` продолжает защищать основной словарь и `support/*`.
- AC15 (удаление `glow_base`): `demo/smoke_room_dimming_removed.mjs` обновлён под новые контролы, но сохраняет прежние негативные проверки — «Reset does not recreate the retired role», откат черновика не пишет конфиг, сохранённое legacy-значение переживает открытие/сохранение формы.
- Мутанты `general-tile-opacity-writes-a-neighbour-key` и `general-north-clear-writes-zero` (защита AC3/AC5) адаптированы под новый DOM/события, логика проверки не ослаблена — сравнил старый/новый `find`/`replace` построчно.

## AC · чем доказан · чем краснеет (выборочно, защитные AC)

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC3 (цвет+% в одном ключе, не соседний) | `demo/smoke_general_settings_form.mjs` (`tileOpacityWritesOwnKey`) | мутант `general-tile-opacity-writes-a-neighbour-key` (реестр, обновлён под новый DOM) |
| AC5 (пустой север → null, не 0°) | `demo/smoke_general_settings_form.mjs` (`emptyNorthStaysUnset`) | мутант `general-north-clear-writes-zero` (реестр, обновлён) |
| AC11/§9 (ZHA/Z2M presence) | `test/settings-sections.test.mjs` (unit, 3 сценария) | негативные случаи внутри теста (fetch failure/MQTT-only/bridge). **Пропущен** сценарий «игнорируемая запись» — находка №1 |
| AC14 (одна актуальная отмена) | нет автотеста на комбинацию `canOptimizeUndo && undoKind==='import'` в разделе «Данные» | **пусто** — находка №2 |
| ux-уточнение (hover-переход списков) | нет | **пусто** — находка №3 |
| AC15 (glow_base legacy) | `demo/smoke_room_dimming_removed.mjs` | ассерты внутри теста («Reset does not recreate the retired role», сверка `houseplan/config/get` до/после discard) |
| perf (ленивый граф) | `scripts/bundle-budget.mjs` ceiling + `docs/ARCHITECTURE.md` | бюджетный тест на бандл (`npm run build` + bundle-policy, часть «Всегда»-гейтов, зелёный по Validate) |

## Чего не проверял

- Не перегонял `tsc`/`npm test`/`npm run build`/bundle-policy сам — положился на зелёный Validate на материале (`68735d36`, ссылка выше), как разрешает п.8.
- Не запускал `golden:verify`, демо-смоки (`smoke_settings_select.mjs`, `smoke_settings_navigation.mjs`, обновлённые `smoke_general_settings*.mjs`, `smoke_room_dimming_removed.mjs` и др.) и `node scripts/smoke-select.mjs` — читал их диффы и логику, не исполнял; возможные регрессии, которые проявляются только при реальном рендере (а не при чтении кода), могут быть не замечены.
- Не проверял визуально (браузер/скриншот) соответствие макету v10 построчно по AC1 (пропорции, отступы в реальном рендере, три темы, 320–390px) — только по коду и существующим CSS-правилам; ручная dev/GPU-приёмка владельцем добровольна и её отсутствие не находка (REVIEWER.md).
- Не проверял качество/точность переводов DE/FR по смыслу (только структурный паритет ключей и плейсхолдеров).
- Не проверял реальную доступность `https://houseplan.tech/convert/` (внешняя сеть, не относится к коду репозитория) — см. Low-находку про слэш.
- Не прогонял `pytest tests_backend` и Python-харнес — серверный контракт не менялся, задача клиентская.
- Не проверял инварианты модели — геометрия плана/комнат не затронута.
- Не перепроверял полностью все 47 полей из таблицы §1 построчно по значению/единице на реальных данных — сверял выборочно (North, цвета, Zigbee, фон, конвертер) и доверился смокам/тестам по остальным, перечисленным в диффах выше.

## Вердикт

Найдено 0 High, 3 Medium в скоупе (находки 1–3). Medium в скоупе без High — жёлтый вердикт, возврат автору в текущем issue (без нового issue, mode=issues относится только к находкам вне скоупа, которых нет).

Вердикт: жёлтый · заход r1 · блокирующих циклов 1/4 · High: 0 · Medium: 3 → в задаче
Документ: docs/reviews/CODE-REVIEW-948-r1.md

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/948-settings-dialogs`, коммит `68735d366025` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `e31c60f840a85bfa52123ab1ff9628b73fe7d3ed`
  ```
  git log --all --format='%H %T' | grep e31c60f840a8
  ```
- Тело issue: `b187404be2af672779bfaf0a6b8fb20b5afcbaa90d05e9c014f6d2047ef769ed`
- Вердикт конвейера: `yellow` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUzODksIm91dHB1dF90b2tlbnMiOjIzLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1NTAzOTk5OTk5OTk5OTk5fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoyMDYsIm91dHB1dF90b2tlbnMiOjkxMDUzLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjM5ODg4MSwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjk1ODAxMjQsImNvc3RVc2RFc3RpbWF0ZSI6NC4xMzE2Mzc4fV0sInR1cm5zIjo3MywiZHVyYXRpb25NcyI6NjIxMTg1LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6NC4xMzcxNDE4LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=5595 output_tokens=91076 cache_creation_input_tokens=398881 cache_read_input_tokens=9580124 num_turns=73 -->
