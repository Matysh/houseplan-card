# Код-ревью issue #200 — r1

- Issue: [#200](https://github.com/Matysh/houseplan-card/issues/200)
- ТЗ: [docs/specs/200-room-label-parity.md](../specs/200-room-label-parity.md)
- ТЗ-ревью: [SPEC-REVIEW-200-r1.md](SPEC-REVIEW-200-r1.md) — зелёный
- Диапазон: `origin/dev..HEAD` (детач на `origin/issue/200-room-label-parity`),
  коммиты `4089c91`, `bf83246`, `cd029a0`, `88a2877`
- Продуктовая реализация: `cd029a0` (`Issue: #200`, `User-Visible: yes`)
- Сопутствующий коммит: `88a2877` (обновление docs-скриншотов, `User-Visible: no`)

## Вердикт

**Зелёный · цикл r1/4 · High: 0 · Medium: 0**

## Скоуп проверки

Только код-ревью реализации (`cd029a0`, `88a2877`) против принятого ТЗ.
ТЗ и его ревью не пересматривались повторно. Проверялись:

- продуктовый код `src/houseplan-card.ts`, `src/styles.ts`;
- тесты/гейты: `demo/smoke_room_link.mjs`, `demo/golden/{harness,matrix}.mjs`,
  `test/golden-matrix.test.mjs`, `scripts/mutation-gate.mjs`;
- документация: `docs/TESTING.md`, `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`,
  `docs/USER-GUIDE.ru.md` (на предмет противоречий), сгенерированные бандлы и
  docs-скриншоты.

## Как проверялось — гейты

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный |
| Unit | `npm test` | 909 passed, 0 failed |
| Build + 3 копии бандла | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js && cmp dist/houseplan-card.js demo/srv/assets/houseplan-card.js` | зелёный, все три идентичны |
| Целевой smoke (AC1, AC2, AC3, AC4, AC5, AC6 частично) | `node demo/smoke_room_link.mjs` | зелёный; во всех 4 комбинациях DPR×theme `nameDeltas`/`metricDeltas` = `[0,0,0,0]` |
| Mutation gate, якоря | `node scripts/mutation-gate.mjs --check` | зелёный, все 30 мутантов (включая 2 новых) применяются ровно один раз |
| Mutation gate, мутант 1 (AC9) | `node scripts/mutation-gate.mjs --id=plan-room-area-icon-hidden` | чистый прогон зелёный, на мутанте `demo/smoke_room_link.mjs` **упал**, как обязано |
| Mutation gate, мутант 2 (AC9) | `node scripts/mutation-gate.mjs --id=plan-room-area-icon-navigates` | чистый прогон зелёный, на мутанте `demo/smoke_room_link.mjs` **упал**, как обязано |
| Соседний smoke (AC6, regression) | `node demo/smoke_room_cards.mjs` | зелёный — handles/gear/scale/placeholder-cases не задеты |
| Соседний smoke (AC3, pointer routing regression) | `node demo/smoke_card_tool_conflict.mjs` | зелёный — маршрутизация клика/pointerdown между инструментом и карточкой не сломана |
| Визуальный результат | `npm run golden:verify` | все существующие сценарии — `passed`; 4 новых (`room-label-parity-*`) — `missing-baseline` (ожидаемо, см. ниже) |
| Офлайн process-gate | `node scripts/process-gate.mjs` | «гейт пройден, предупреждений 0» |
| CI-провенанс (по ссылкам автора) | `gh api .../jobs/96101891192` → job `smoke` на SHA `cd029a0` | `success`; run `32263084569` на SHA `88a2877` → `docs`/`provenance`/`process-gate` все `success` |

Полный browser-smoke набор (127 файлов), `python -m pytest tests_backend` и
performance-профили **не гонялись** локально:

- backend/Python не тронуты (diff не содержит `custom_components/**/*.py`) —
  прогон бэкенд-тестов не нужен;
- полный smoke-набор избыточен: диапазон изменений — рендер и event-routing
  одной подсистемы (room-label), целевой smoke плюс два смежных
  (`room_cards`, `card_tool_conflict`) покрывают затронутую поверхность;
  Linux CI `smoke`-job на этом же SHA (см. таблицу) прошёл целиком;
- performance profiles не названы в AC; риск в ТЗ (§11 спека) обоснован как
  пренебрежимый (не добавляются timers/subscriptions/network calls), и
  `performance_smoke`-job Linux CI на SHA `cd029a0` зелёный (проверено через
  `gh api`, не процитировано автором явно, но подтверждает отсутствие
  регрессии).

## AC — как каждый доказан

| AC | Доказательство | Итог |
|---|---|---|
| AC1 | `smoke_room_link.mjs`: `view-link-per-area-room`, `plan-keeps-links` — счётчик `.rlgo` равен числу комнат с `area` в обоих режимах, во всех 4 комбинациях DPR×theme | доказано автотестом, тест умеет падать (мутант `plan-room-area-icon-hidden`) |
| AC2 | `smoke_room_link.mjs`: `view-navigates` — перехват `history.pushState`, URL содержит `/config/areas/area/` | доказано автотестом |
| AC3 | `smoke_room_link.mjs`: `plan-does-not-navigate` (клик по иконке + реальный pointer-drag не меняют route/режим) и `plan-icon-drags-label` (drag, начатый на иконке через `page.mouse`, меняет `layout.rl_<id>`) | доказано автотестом, тест умеет падать (мутант `plan-room-area-icon-navigates`) |
| AC4 | `smoke_room_link.mjs`: `core-name-parity`/`core-metrics-parity`, допуск ≤0,5 CSS px — фактические дельты 0 во всех комбинациях | доказано автотестом, оба мутанта дополнительно валят именно этот AC |
| AC5 | Тот же smoke прогнан в light/dark при DPR 1 и 2 (`theme-applied` подтверждает применение темы); `plan-controls-preserved` проверяет, что `.rlhandle`×4 и кнопка настроек не входят в core-измерение | доказано автотестом; golden-review см. ниже |
| AC6 | Диагностика по коду: код, отвечающий за `room.unnamed`-placeholder (`r.name || (this._markup ? this._t('room.unnamed') : '')`), диффом не тронут — проверено чтением, не исполнением. Отсутствие иконки у area-less room — тот же численный inline-инвариант AC1 (счётчик `.rlgo`). Regression прогнаны `smoke_room_cards.mjs` (handles/gear/scale/partial-metrics) и `smoke_card_tool_conflict.mjs` (маршрутизация клика/резайза) — оба зелёные | доказано смесью автотеста и чтения кода |
| AC7 | `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` и `docs/TESTING.md` правлены в том же коммите `cd029a0`, что и поведение | проверено чтением diff |
| AC8 | Таблица гейтов выше — все зелёные до постановки `S7-code-review` | доказано |
| AC9 | Два новых entries в `scripts/mutation-gate.mjs`, guard `node demo/smoke_room_link.mjs`; лично прогнаны `--id=plan-room-area-icon-hidden` и `--id=plan-room-area-icon-navigates` — оба: чистый прогон зелёный, на мутанте guard красный | доказано выполнением, не только чтением реестра |

## Что проверено и корректно

- **Механизм фикса.** `.rlgo` теперь рендерится всегда, когда `r.area` истинен
  (`showAreaLink = !!r.area`), а не только вне `_markup`. Интерактивность
  (`title`, `@click`, `@pointerdown`-`stopPropagation`) остаётся только при
  `areaLinkInteractive = !this._markup`, то есть **в Plan `pointerdown` с
  иконки не глушится и всплывает** в `.roomlabel`, где его подхватывает уже
  существующий `_labelDown()` — drag с иконки использует тот же threshold,
  pointer capture и сохранение layout, что и drag с текста. Реализует ровно
  Q1/AC3 контракт из ТЗ.
- **Геометрический инвариант (AC4/AC5).** Новый приватный метод
  `_roomLabelReferenceViewWidth()` (houseplan-card.ts:5011) активен только при
  `this._markup` (то есть только в Plan editor — Devices/Background editors и
  View не задеты, что соответствует non-scope ТЗ) и вычисляет «гипотетическую»
  View-ширину через уже существующий `_viewForModeTarget()`, подставляя
  `stage.clientHeight + editorchrome.height` вместо фактической высоты stage.
  Через новую CSS-переменную `--rl-icon-size` (`src/styles.ts:876`) это
  значение становится базовым `font-size` для `.roomlabel`, от которого через
  `em` наследуются `.rlname` (897) и `.rlmetrics` (975, `0.75em`) — то есть
  правится не только размер иконки, а вся core-карточка целиком, что и
  требует AC4. В View/Devices/Background `_roomLabelReferenceViewWidth`
  возвращает `view.w` без изменений — визуальный результат этих режимов
  побайтово не меняется, что подтверждает `golden:verify`: все прежние
  сценарии (включая `geometry-*`, `lighting-*`) остались `passed` без единого
  diff.
- **Числовой smoke** (расширенный `demo/smoke_room_link.mjs`) измеряет
  bounding box `.rlname`/`.rlmetrics` относительно центра `.roomlabel` (а не
  viewport), что соответствует решению владельца Q2 — chrome/stage-высота не
  участвует в сравнении. Проверено выполнением: дельты действительно 0, а не
  «в пределах допуска, но не ноль» — запас на реальных условиях больше
  требуемого.
- **Mutation gate.** Оба обязательных по ТЗ (§10.3) мутанта зарегистрированы
  и лично проверены на способность красить guard в красный — это снимает
  главный риск процесса («зелёный тест, который ничего не проверяет»).
- **Трейлеры и changelog.** `cd029a0`: `Issue: #200`, `User-Visible: yes`,
  оба changelog правлены в этом же коммите. `88a2877`: `User-Visible: no`,
  документация без поведенческих изменений.
- **i18n.** Diff не содержит правок `src/i18n/*.json` — соответствует ТЗ
  («новых строк и переводов нет»); в Plan иконка не получает новый
  `title`/`role`, что и обещано в §8 ТЗ.
- **`docs/USER-GUIDE.ru.md`** не содержит формулировок, противоречащих новому
  поведению (искал по «зон», «rlgo», «перейти к комнате» — совпадений с
  описанием этого взаимодействия нет).

## Находки

Нет находок High или Medium. Одна Low, снимается без цикла:

- **Low.** CSS-переменная `--rl-icon-size` (`src/styles.ts:876`,
  `houseplan-card.ts:15820`) по имени выглядит как «размер только значка», но
  фактически задаёт базовый `font-size` всей `.roomlabel`-карточки — и имени,
  и значка, и (через каскад `em`) `.rlmetrics`. Название сбивает при будущем
  чтении кода рядом с уже существующим `--icon-size`/`--dev-size`, которые
  влияют только на маркеры устройств. Функционально не является дефектом:
  поведение проверено численно и совпадает с контрактом AC4/AC5. Снимаю с
  записью — переименование не меняет наблюдаемое поведение и не стоит
  отдельного цикла ревью.

## Чего не проверял

- Полный browser-smoke набор (127 файлов) — прогнаны только целевой
  (`smoke_room_link`) и два смежных по поверхности (`smoke_room_cards`,
  `smoke_card_tool_conflict`); остальные не относятся к затронутому коду.
- `python -m pytest tests_backend` — backend/Python не тронуты этим diff’ом.
- Golden baseline acceptance — 4 новых сценария `room-label-parity-*` не
  имеют эталона (`missing-baseline` в `golden:verify`), что ожидаемо и
  соответствует процессу: эталоны принимаются только `npm run golden:accept
  -- --reviewed` на полном Linux CI артефакте перед бетой, не в issue-ветке.
  Визуально просмотрел сгенерированные `artifacts/golden/actual/room-label-
  parity-{view,plan}-{light,dark}.png` — состав и выравнивание карточки
  совпадают между View и Plan в обеих темах, дополнительных дефектов не
  увидел.
- Ручной тест на реальном touch-устройстве — вне контракта задачи (Plan
  editor — best effort по `docs/TOUCH-SUPPORT.md`); pointer-маршрутизация
  для touch не отличается от мыши на уровне событий, проверено чтением.
- Performance-профили (`performance_smoke`) не гонялись локально; риск в ТЗ
  назван пренебрежимым и подтверждается зелёным `performance_smoke`-job на
  SHA `cd029a0` в CI (обнаружено через `gh api`, не было процитировано
  автором в хендоффе).
