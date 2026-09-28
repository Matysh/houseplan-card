# CODE-REVIEW-687-r1

Issue: [#687](https://github.com/Matysh/houseplan-card/issues/687) — «Редактор плана: показывать значки устройств
ориентирами — 1 в 1 как в редакторе подложки».
Материал: `git log --oneline origin/dev..HEAD`, `git diff origin/dev...HEAD` на SHA
`128af2392a3d75e75716a69271682bbf1775cc09` (рабочая копия уже на нём).
Заход: r1 · блокирующих циклов израсходовано 0 из 2 (лёгкий трек, лимит 2).

## Скоуп диффа

Два коммита поверх `dev`@`cab4b415`:

- `560849a1` — поведение (`src/styles/plan.styles.ts`), новый смок
  `demo/smoke_plan_device_landmarks.mjs`, три мутанта в
  `scripts/mutation-registry.mjs`, правка комментария в
  `demo/smoke_feedback_v2.mjs`, `docs/UX-MODES.md`, `docs/DECOR-EDITOR.md`,
  `docs/USER-GUIDE.ru.md`, оба changelog. `User-Visible: yes`.
- `128af239` — Node-свидетель трёх мутантов (`test/plan-device-landmarks.test.mjs`)
  вместо браузерного гварда (реестр на потолке 200/200, #659), смок переведён
  на `window.__hpTest`. `User-Visible: no`.

Продуктовый код меняется одним CSS-правилом:

```css
.stage.markup .devlayer .dev { filter: opacity(0.35); }
.stage.markup .devlayer .dev,
.stage.markup .devlayer .dev *,
.stage.markup .devlayer .dev::before { pointer-events: none; }
```

вместо прежнего `.stage.markup .devlayer .dev { display: none; }`. Обработчики
маркера (`_pointerDown`, `_clickDevice`, `_keyDevice`, `_ctxDevice`, hover-tip,
`interactive`/`tabindex`) не тронуты — уже закрыты вне `view`/`devices`.

Задача из `docs/SCOPE.md`: J6 «Keep the plan true as the home evolves» — расстановка
стен/проёмов/лестниц относительно устройств без переключения в View; узкая,
не расширяет скоуп.

## Как проверялось

Дешёвые гейты подтверждены зелёным Validate на этом SHA (run 36389513894 /
36389932937, ссылка в задаче) — `npx tsc --noEmit`, `npm test`, `npm run build`
+ `bundle-policy --verify` не перегонялись отдельно (#343). `heavy`-профиль
Validate (браузерные смоки) на обычном push веток задач не запускается
(`validate.yml` `changes.heavy`), поэтому смоки — моя обязанность в этом цикле.

`node scripts/smoke-select.mjs --base origin/dev --head HEAD` → **НЕОПРЕДЕЛЁННОСТЬ**
(диф — чистый CSS, ни один смок не связан доказуемо; выборка не отменяет
суждения). Прогнал сам смоки, названные в AC, плюс регрессию:

| Гейт | Команда | Результат |
|---|---|---|
| Build (для актуального `dist`/`test-build`) | `npm run build`, `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs`, `node scripts/bundle-sync.mjs` | OK |
| Node-свидетель каскада (AC1 п.2, AC2, AC3 scoping) | `node --test test/plan-device-landmarks.test.mjs` | 4/4 OK |
| Смок AC1+AC2 (новый) | `node demo/smoke_plan_device_landmarks.mjs` | OK, все 24 поля `true` |
| Регрессия AC3 (кнопка настроек комнаты) | `node demo/smoke_feedback_v2.mjs` | OK |
| Регрессия ориентиров подложки (#362) | `node demo/smoke_decor.mjs` | OK |
| Мутант `plan-device-landmarks-hidden` | `node scripts/mutation-gate.mjs --id=plan-device-landmarks-hidden` | поймано 1/1 |
| Мутант `plan-device-landmarks-override-own-opacity` | `node scripts/mutation-gate.mjs --id=plan-device-landmarks-override-own-opacity` | поймано 1/1 |
| Мутант `plan-device-landmarks-hit-target` | `node scripts/mutation-gate.mjs --id=plan-device-landmarks-hit-target` | поймано 1/1 |
| Реестр мутантов на потолке | `node --test --test-name-pattern="#659: browser guard inventory" test/mutation-gate.test.mjs` | OK, 200/200 |
| Монолит не читается новым тестом как текст | `node --test test/monolith-text-anchors.test.mjs` | OK — `plan-device-landmarks.test.mjs` не попал в новые якоря (читает `test-build/styles.js`, не `.ts`-исходник) |
| Процессный гейт диапазона | `node scripts/process-gate.mjs --range origin/dev..HEAD` | 0 предупреждений (проверка 8 «статус issue» не запускалась — не требуется вне `--issues`) |
| Документация | `node scripts/check-docs.mjs --screenshots=warn` | passed; WARN об отпечатке скриншотов — ожидаемо (сдвигает любая правка `src/**`), закрывается на кандидате |
| Реестр мутантов: синтаксис/coverage | `node scripts/mutation-registry.mjs --check`, `node scripts/check-inputs.mjs --coverage` | OK |
| entry-cost | `node --test test/entry-cost.test.mjs` | 3/3 OK |

После прогона `npm run build` дерево вернул `npm run bundle:clean`
(`git status` чист) — в репозиторий ничего не писал.

## Разбор AC

**AC1 — видимость и непрозрачность.** Прочитан код: `.stage.markup .devlayer
.dev { filter: opacity(0.35) }` не трогает `opacity` каждого маркера, поэтому
`.dev.unavail` (собственная `opacity:.35`) даёт итог `0.35 × 0.35`, как того
требует контракт. Смок подтверждает это на живом DOM:
`planShowsViewMarkers` (множество `data-id` плана = View),
`planOpacityMatchesBackground` (посчитанная альфа плана и подложки совпадает
для каждого видимого маркера, включая один искусственно сделанный
`unavailable`), `planPlainMarkerAt35` (0.35 ± 1e-3), `planUnavailableMarkerAt35x35`
(0.35² ± 1e-3). Чем краснеет: мутант `plan-device-landmarks-hidden` возвращает
`display:none` — красит Node-тест 1; мутант `-override-own-opacity` заменяет
`filter` на `opacity` — красит Node-тест 2 (и увёл бы смок с `.unavail` на 35%
вместо 12.25%). Оба поймано 1/1 на текущем HEAD.

**AC2 — полная неинтерактивность.** Прочитан код: обработчики `_pointerDown`,
`_clickDevice`, `_keyDevice`, `_ctxDevice`, `pointerover`-tip уже гейтятся
`this._mode !== 'view' && this._mode !== 'devices'` — эта часть контракта не
менялась в диффе, только стала наблюдаемой (маркер раньше был `display:none`,
то есть даже без событий). `interactive = mode === 'view' || 'devices'` держит
`tabindex`/`role` не выставленными в Plan. Смок доказывает это исполнением, а
не только чтением: реальный клик мышью (`page.mouse.click`) в центр видимого
маркера добивает точку в цепочку «Стен» (`wallsToolReceivesClickThroughMarker`),
реальный клик в маркер над кнопкой настроек комнаты открывает диалог комнаты
(`roomSettingsOpenThroughMarker`) — то есть контракт «маркер не владеет точкой»
проверен не только `elementFromPoint`, но и настоящим browser-событием. Прямая
диспетчеризация `pointerover/pointerdown/pointerup/click/contextmenu` на сам
DOM-узел маркера (события, которые `pointer-events:none` не блокирует, так как
это programmatic dispatch, а не hit-test) не меняет `_tip`/`_infoCard`/
`_deviceDrag`/`_selId`, не вызывает `callService`/`callWS`, не ставит
`data-hp-device-hover`, `contextmenu` не помечен `defaultPrevented`. Чем
краснеет: мутант `plan-device-landmarks-hit-target` снимает блок
`pointer-events:none` — красит Node-тест 3 (в браузере вернул бы захват клика
маркером); поймано 1/1.

**AC3 — подписи комнат и границы режимов.** Прочитан код: правило непрозрачности
и правило неинтерактивности в диффе явно скопированы на `.dev`, а не на весь
`.devlayer` — `.roomlabel` (сосед `.dev` внутри того же `.devlayer`) сохраняет
собственное `.stage.markup .roomlabel { pointer-events: auto; }` (строка 686,
не менялась) и не получает `filter`. Смок: `roomLabelNotFaded` (эффективная
альфа подписи равна её собственной `opacity`, без множителя из `.dev`-правила),
регрессия `demo/smoke_feedback_v2.mjs` (кнопка настроек читаема и открывает
диалог) и `demo/smoke_decor.mjs` (ориентиры подложки #362 не задеты) — зелёные.
Node-тест 4 (`the landmark fade is scoped to the Plan editor stage`) пинует,
что всякое правило с `filter: opacity(0.35)` над `.dev` начинается с
`.stage.markup ` — View/Devices/kiosk не затронуты. «Правила ограничены
`.stage.markup`» проверено чтением (единственное новое правило) и Node-тестом
одновременно.

Ни один AC не остался «доказан заявлением»: у каждого есть либо исполненный
браузерный смок, либо Node-тест с подтверждённой мутацией, либо обе проверки
вместе.

## Продуктовое рассуждение

Сценарий закрыт буквально: администратор видит устройства в редакторе плана
теми же значками/на тех же местах, что и в View, и ни один инструмент плана
(«Стены», настройки комнаты) не блокируется маркером — проверено реальным
кликом мыши, а не только `elementFromPoint`. Решение владельца «1 в 1 как в
подложке» перенесено без отклонений от контракта; единственное сознательно
задокументированное отличие (в блоке «Принято предположительно») — множитель
через `filter` на каждом `.dev`, а не групповой `opacity` на `.devlayer`, по
объективной причине (подписи комнат — тот же слой). Риски (визуальное
перекрытие превью инструментов маркерами, сдвиг golden) названы в ТЗ и приняты
владельцем заранее; ничего нового не всплыло при чтении кода.

## Находки

Ничего блокирующего. Одно наблюдение Low, снимаю сам без возврата автору:

- **Low (снято без правки).** Значение 0.35 — не единый источник: в
  `src/houseplan-card.ts:10868` оно живёт в тернарнике
  `this._mode === 'decor' ? 0.35 : 1` (Background), в `plan.styles.ts:1186`
  (новая строка) — отдельным литералом `filter: opacity(0.35)` для Plan. Прямого
  разделяемого источника (общей CSS-переменной/константы) нет; изменение
  значения для Background потребует отдельно вспомнить про Plan. Не поднимаю до
  Medium: (а) числовое равенство проверяется исполнением на каждом прогоне —
  `planOpacityMatchesBackground` в новом смоке сравнивает вычисленные (а не
  захардкоженные) альфа-значения plan/decor и упадёт при любом расхождении;
  (б) унификация потребовала бы также переписать вычисление CSS-переменной в
  TS-тернарнике на добавление `'plan'` в условие — это уже не CSS-правка одной
  сцены, вне соразмерного объёма лёгкой задачи (PROCESS.md §8). Риск дрейфа
  реален, но пойман автоматически, а не тихо.

## Что проверено и корректно

- Контракт п.1–5 ТЗ — see AC-разбор выше; смоки и Node-тесты исполнялись
  реально на этом SHA, не переиспользовались вслепую.
- Три мутанта регистрируют реальную защиту (guard красный на исходном
  правиле, зелёный после патча) — не «тест умеет падать» без названной
  мутации: команды и результат приведены в таблице гейтов.
- Документация (`UX-MODES.md`, `DECOR-EDITOR.md`, `USER-GUIDE.ru.md`, оба
  changelog) обновлена в том же коммите, что и поведение (`560849a1`,
  `User-Visible: yes`) — трейлеры соблюдены.
- `test/plan-device-landmarks.test.mjs` не входит в замороженный список тестов,
  читающих монолит как текст (#624) — подтверждено исполнением
  `monolith-text-anchors.test.mjs`; читает скомпилированный `test-build/styles.js`,
  а не `src/houseplan-card.ts`.
- Обработчики маркера, `interactive`/`tabindex`, `_ctxDevice` — прочитаны в коде
  и подтверждают заявление «как сейчас» из тела issue дословно (номера строк
  совпадают с точностью до текущего HEAD).
- `DEVICE-PRESENTATION.md` не требует правки — описывает анатомию маркера, а не
  видимость по режимам; в диффе анатомия не меняется.
- Магнитные цели (контракт п.3, последний пункт «маркер не цель привязки») —
  не проверены новым смоком отдельно, но это не регрессия: `DECOR-EDITOR.md`
  фиксирует, что магнит и раньше исключал устройства («The image, devices and
  openings are excluded»), а привязка в редакторе плана считается по геометрии
  комнат/стен, не по DOM-хиттесту маркеров, — видимость маркера эту логику не
  затрагивает.

## Чего не проверял

- `typecheck`/`npm test`(полный)/`npm run build` со сверкой бандла как отдельный
  прогон — приняты по зелёному Validate на этом SHA (#343); build я всё же
  выполнил локально (для актуализации `test-build`/`dist` под смоки) и он
  зелёный, но не сверял три копии бандла (`bundle-policy --verify`) отдельно —
  не требуется, дифф не трогает `src/**` за пределами стилей и не относится к
  выпуску.
- `npm run golden:verify` — не гонял. Дифф видимо меняет рендер (маркеры теперь
  рисуются в `.stage.markup`), кадры golden редактора плана с устройствами
  ожидаемо разойдутся — это named риск в ТЗ, и ТЗ прямо относит их приёмку на
  предрелizный гейт коммитом с `Release:` (`golden:accept --reviewed
  --expect-change=<id…>`, §11.4). Гонять `golden:verify` в этом цикле означало
  бы зафиксировать заведомо ожидаемое расхождение как «находку» — не гейт этого
  ревью.
- `python -m pytest tests_backend` — не гонял, диф не трогает
  `custom_components/**/*.py`.
- `npm run invariants` — не гонял, диф не меняет геометрию модели или ссылки на
  неё (только CSS-презентация).
- Performance-профили — не названы в AC, не гонял.
- Полный `npm run gate:small` целиком — гонял точечные его составляющие
  (сборка, Node-тест, целевые смоки, process-gate, check-docs,
  mutation-registry/check-inputs, entry-cost); не гонял полный набор смоков
  матрицы (279 смоков) — вне объёма код-ревью на лёгком треке (§8, «Полные
  наборы — предрелизный гейт»).

## Материал раунда

`git rev-parse HEAD` на момент ревью: `128af2392a3d75e75716a69271682bbf1775cc09`.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/687-plan-editor-device-landmarks`, коммит `128af2392a3d` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `8e3f664c15634ec66041bba978ed865101bfd4f8`
  ```
  git log --all --format='%H %T' | grep 8e3f664c1563
  ```
- Тело issue: `266af7ca2b7a21e08ab181761390dc4bab1425862dc2c6e48811d7777da34daa`
- Вердикт конвейера: `green` · High 0
