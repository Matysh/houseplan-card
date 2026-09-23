# CODE-REVIEW-609-r1

Материал: `4b27268e2fa7278da70d01a5b0e55e366a2e078d` (заход r1, HEAD в момент ревью).
Коммиты в диапазоне `origin/dev..HEAD`:

- `4c9e0132` fix(dialog): align HA settings form shell (#609) — продукт + доказательства, `User-Visible: yes`, оба changelog в том же коммите.
- `4b27268e` test(dialog): strengthen mobile fullscreen witness (#609) — усиление одного mutation-witness, `User-Visible: no`.

## Скоуп

ТЗ (§10) требует привести оболочку пяти `form-shell`-диалогов (space/settings/room/marker/onboarding) в настоящем `ha-dialog` к оболочке референса #600: 560 px desktop, `min(940px, 100dvh-48px)`, канва тела, один HA-скроллер, fullscreen ≤480 px, генерик-диалоги и нативная ветка не тронуты. Диапазон подтверждает: изменения ограничены `src/hp-dialog.ts` и `src/styles/dialogs.styles.ts` плюс тестовая/диагностическая инфраструктура (`demo/**`, `scripts/**`, `test/**`) и документация — ровно то, что заявлено в §4 скоупа ТЗ. Продуктовых файлов вне `hp-dialog.ts`/`dialogs.styles.ts` в диффе нет.

## Как проверялось

Дешёвые гейты (typecheck/test/build) уже зелёные на этом SHA в Validate
(https://github.com/Matysh/houseplan-card/actions/runs/35801912206) — не
перегонялись повторно. Ниже — то, что Validate на обычном push не покрывает
(`heavyGatesRequested` включает смоки/golden только на `pull_request`,
`workflow_dispatch --full`, `schedule` или коммите с трейлером `Release:` —
ничего из этого здесь нет), и что выбрано по дифф/AC и прогнано мной лично.

| Гейт | Команда | Результат |
|---|---|---|
| Выбор смоков по дельте | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | зарегистрированная связь → `smoke_dialog_modal_recovery.mjs`, `smoke_ha_form_shell_parity.mjs` |
| Дешёвый HA-подобный smoke (AC3/AC6, Validate-свидетель) | `node demo/smoke_ha_form_shell_parity.mjs` | OK, все проверки (560 px, canvas, fullscreen 480/390/1280×480, generic 580 px) прошли |
| Регресс native lifecycle | `node demo/smoke_dialog_modal_recovery.mjs` | OK, все 22 проверки true |
| Фокусные smokes 4 форм (AC4) | `node demo/smoke_space_settings_form.mjs`, `..._general_settings_form.mjs`, `..._room_settings_form.mjs`, `..._device_settings_form.mjs` | все OK |
| Регресс 5 потребителей form-shell | `node test/form-shell-consumers.test.mjs` | pass 1/1; проверил, что тест умеет падать: временно снял `form-shell` с room-settings-dialog.ts → тест красный; откатил (`git checkout --`) |
| **Тяжёлая диагностика на настоящем `home-assistant-frontend==20260729.7`** (AC1/AC2/AC5/AC7) | `npm run bundle:sync && node demo/verify_ha_form_shell_609.mjs` | **OK** — прогнал сам (сеть доступна): desktop 1600×1000 → панель 560×940, canvas ≠ card, один HA-скроллер (`haBodyOverflowY:auto`, `formBodyOverflowY:visible`, `haBodyScroll` подтверждает реальный скролл), footer внутри; 480×800 и 390×844 → fullscreen, radius 0px, без горизонтального overflow; 1280×480 → штатный HA fullscreen сохранён; `pageErrors:[]`, `externalRequests:[]`, `websocketAttempts:[]` (AC7) |
| Мутанты #609 (AC6, «чем краснеет») | `node scripts/mutation-gate.mjs --id=<id>` × 3 | все три поймал (таблица ниже) |
| Целостность реестра мутантов | `node scripts/mutation-gate.mjs --check` | exit 0, все `find` уникальны, включая три новых |
| Golden 13(+) сцен диалогов (AC4) | `npm run golden:verify` | **passed** на Linux, все сцены зелёные, включая `device-dialog-*`, `room-temperature-dialog-*`, `room-discard-dialog-mobile-ru`, `toggle-entity-dialog-*`, `settings-help-zoom-200-*` |
| Свежесть doc-скриншотов и ссылок | `node scripts/check-docs.mjs` | passed (7 файлов, 12 внешних ссылок); `docs/images/screenshots.json` — `sourceFingerprint` изменился (src/** тронут), но все 11 `imageSha256` идентичны — визуально нативная ветка не изменилась |
| `no-new-any` | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | новых `any` нет (36 добавленных строк в 2 файлах) |
| Бюджет бандла | `npm run bundle:budget` | initial View 290460 B ≤ потолка 291400±2000; только предупреждение о низком запасе (существующий долг #367/#474, не новый) |

### Таблица «чем краснеет» (AC6, §2.7 обязательна для защитных AC)

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC6 (ширина 560 не деградирует до generic 580) | `node demo/smoke_ha_form_shell_parity.mjs` | мутант `ha-form-shell-width-falls-back-to-generic` (560→580px) — поймал: `node scripts/mutation-gate.mjs --id=ha-form-shell-width-falls-back-to-generic` → «покраснел на мутанте» |
| AC6 (канва не сливается с card) | тот же smoke | мутант `ha-form-shell-loses-canvas` (canvas=card background) — поймал |
| AC6 (mobile fullscreen не сохраняет desktop-инсет) | тот же smoke | мутант `ha-form-shell-mobile-keeps-desktop-inset` (−48px на min/max-height) — поймал |
| AC3 (пять потребителей несут `form-shell`) | `test/form-shell-consumers.test.mjs` (чистый юнит, регекс по исходнику) | не зарегистрированный мутант (не обязателен — юнит, не дорогой гейт), но проверил вручную: снял атрибут у room-settings-dialog.ts → тест красный, откатил |

## Находки

### Medium (в скоупе) — AC5 не доказан ни одним добавленным свидетелем

ТЗ AC5: «Light/dark и 200% text не создают второй scroll, обрезанный footer или
слияние карточек с канвой. Доказательство: адресные кадры/геометрические
проверки диагностического сценария» — то есть доказательство обещано именно
новым диагностическим сценарием этой задачи.

Прочитал оба добавленных файла целиком:

- `demo/verify_ha_form_shell_609.mjs` — четыре вьюпорта (1600×1000, 480×800,
  390×844, 1280×480), ни разу не переключает тему и не меняет размер шрифта;
- `demo/smoke_ha_form_shell_parity.mjs` — та же картина: только resize
  вьюпорта, ни `documentElement.style.fontSize`, ни варианта темы.

Более того, сама фикстура структурно не может показать «светлую» тему:
`demo/srv/demo.html:9` жёстко прописывает `--card-background-color:#1c2530`
(тёмная палитра) независимо от параметра `colorScheme` фикстуры (тот управляет
только `prefers-color-scheme` браузера, а не значениями токенов, которые задаёт
демо-страница). Я прогнал `verify_ha_form_shell_609.mjs` сам: `cardBackground`
во всех кадрах — `rgb(28, 37, 48)`, то есть тот же жёстко заданный тёмный тон;
светлая тема в этом сценарии физически не встречается ни разу.

Ни одна из двух половин AC5 (тема, 200%-текст) не имеет исполнимого свидетеля
в этом дифф. Соразмерный оракул был дёшев и достижим: тот же уже открытый
настоящий `ha-dialog` из `verify_ha_form_shell_609.mjs` можно было
дополнительно проверить с `documentElement.style.fontSize='32px'` (соседний
диагностический README для #505 уже описывает ровно такой приём — «Separate
32px root-font cases exercise enlarged text») и с переопределением
`--secondary-background-color`/`--card-background-color` перед `settle()`, не
трогая продукт.

По коду сама реализация читается безопасно для темы (все значения — только
`var(--токен-HA, …)`, литеральных цветов нет) и по аналогии с уже
протестированным нативным путём (golden `settings-help-zoom-200-en-light` /
`-ru-dark` покрывают тот же общий flex/scroll-контракт, только в нативной, а не
HA-ветке) — риск разъезда невелик, но это довод «вероятно работает», а не
доказательство по AC, и сама заявленная в ТЗ форма доказательства (диагностика)
отсутствует. Это находка §2.7: «если соразмерный исполнимый oracle возможен,
его отсутствие — находка», а не тождество отсутствующего теста провалу.

**Воспроизведение:** `grep -n "fontSize\|dark\|theme" demo/verify_ha_form_shell_609.mjs demo/smoke_ha_form_shell_parity.mjs` — пусто.

Единственный Medium в скоупе задачи → вердикт жёлтый; правка — добавить
theme/200%-кейс в уже существующий диагностический сценарий, без нового issue
(#202).

### Low — некорректная ссылка на AC в `mutation-registry.mjs`

Два новых мутанта цитируют несуществующий критерий: `because: '#609 AC1/AC8: …'`
и `'#609 AC4/AC8: …'`. В ТЗ issue критериев приёмки семь (AC1…AC7, раздел
«10. Критерии приёмки»); «AC8» не существует. Похоже на путаницу с пунктом 8
раздела «6. Контракт поведения» («Светлая и тёмная темы используют переменные
HA без фиксированных цветов») — в кодовой базе для таких ссылок принято
обозначение «К<N>» (пример — комментарий в `hp-dialog.ts:196` про «(К6)»), а не
«AC<N>». Сами мутанты работают верно (см. таблицу выше) — это чисто
трассируемость комментария, не функциональный дефект. Снимаю с запиской, цикл
не тратит: `scripts/mutation-registry.mjs`, ключи
`ha-form-shell-width-falls-back-to-generic` и
`ha-form-shell-mobile-keeps-desktop-inset`.

## Что проверено и корректно

- **AC1/AC2 (геометрия в настоящем HA)** — доказано исполнением, не чтением:
  мой собственный прогон `verify_ha_form_shell_609.mjs` против закреплённого
  `home-assistant-frontend==20260729.7` подтвердил 560×940 desktop, canvas ≠
  card, один HA-скроллер, fullscreen на 480×800/390×844 (radius 0, без
  горизонтального overflow), сохранённый штатный HA-fullscreen на 1280×480.
- **AC3 (пять потребителей + generic не тронут)** — `smoke_ha_form_shell_parity.mjs`
  прогоняет все 5 `data-kind` плюс отрицательный контроль (`genericWidth` 580/390/1280
  соответственно вьюпорту, т.е. без изменений); `test/form-shell-consumers.test.mjs`
  зарегистрировал сам факт присутствия атрибута у всех пяти файлов и умеет
  падать (проверил вручную).
- **AC4 (нативная ветка неизменна)** — `golden:verify` зелёный на Linux по всем
  сценам (включая все диалоговые), четыре фокусных smoke форм зелёные,
  `docs/images/screenshots.json` — 11/11 `imageSha256` совпадают, несмотря на
  изменившийся `sourceFingerprint` (т.е. правка не меняет рендер нативной
  ветки при том же исходном коде, только его хэш).
- **AC6 (защитная проверка)** — три заявленных мутанта существуют, каждый
  поймал заявленную им регрессию лично мной (таблица «чем краснеет» выше);
  `mutation-gate.mjs --check` подтверждает, что все `find`-паттерны уникальны
  в файлах.
- **AC7 (изоляция фикстуры)** — подтверждено моим прогоном: `pageErrors`,
  `externalRequests`, `websocketAttempts` — пустые массивы; `fixture.assertClean()`
  выполняется в конце сценария и не бросил.
- **Трейлеры и changelog** — `4c9e0132` несёт `Issue: #609`, `User-Visible: yes`
  и оба changelog (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) в этом же
  коммите; `4b27268e` — `User-Visible: no`, чисто тестовое усиление одного
  мутанта, дополнительного изменения продукта не несёт.
- **Классы риска §2.6** — geometry (границы 480/450/500, разобрано и
  исполнено), visual (промежуточный кадр — диагностика ждёт 250 мс после
  200 мс WebAwesome-анимации, `settle()`), host/input (mouse/touch — новый код
  не меняет обработчики ввода, только CSS-геометрию); data/rights и async
  неприменимы (чистая презентационная правка, минимальны данные и переходы
  состояния не тронуты).
- **Бюджет бандла** — прирост 500 Б задокументирован причиной в самом файле
  (`scripts/bundle-budget.mjs`), пересчитан и подтверждён прогоном.
- **`--dialog-content-padding: 0` не создаёт двойной отступ** — подтверждено
  реальным прогоном: `haBodyPadding` = `0px` во всех кадрах, `.body`
  (light-DOM) сохраняет собственные 16 px из `dialogs.styles.ts`.
- Просмотрел `hp-dialog[form-shell][ha-dialog-shell] .body { min-height: 100%; }`
  и toggle `ha-dialog-shell` в `connectedCallback` — атрибут выставляется
  синхронно до первого рендера, читается тем же селектором, что и в
  `dialogs.styles.ts`; для generic-диалогов (`[form-shell]` отсутствует)
  правило неприменимо — подтверждено smoke (`genericWidth` не сдвинулась).

## Чего не проверял

- **Короткое содержимое формы** (когда высота карточек меньше высоты `.body`
  HA) — во всех прогнанных сценариях (реальная диагностика открывает Room
  settings, смоук использует `height:1200px`) содержимое всегда выше
  контейнера, поэтому `min-height:100%` на `.body` (правило, добавленное
  специально для короткого случая — не оставлять голую поверхность HA под
  канвой) ни разу не оказалось определяющим ограничением. Не завожу как
  находку: ни один AC явно не требует именно этого кадра, а правило — чистый
  CSS `min-height` от процентной высоты явно заданного flex-родителя, что
  обычно ведёт себя предсказуемо; но это не исполненное доказательство,
  только чтение.
- Полный `npm run typecheck`/`npm test`/`npm run build` заново не гонял —
  зелёный Validate на этом же SHA уже есть по ссылке в задаче ревью, а рабочая
  копия после `npm run bundle:sync` не изменила ни файла (`git status` пуст),
  то есть закоммиченный бандл и есть тот, что построен из этого исходника.
- `pytest tests_backend` — не тронут `custom_components/**/*.py`, неприменимо.
- Полная матрица `demo/smoke_*.mjs` (все ~90+ файлов) и performance-профили —
  вне названного диффом/AC объёма; `smoke-select.mjs` не назвал их, AC не
  называет performance.
- Реальные версии `home-assistant-frontend` кроме закреплённой `20260729.7` —
  вне AC (риск §12 ТЗ явно называет это допустимым остаточным риском).

## Материал раунда

- SHA: `4b27268e2fa7278da70d01a5b0e55e366a2e078d` (совпадает с `git rev-parse HEAD` на момент вывода вердикта).
- Дерево: чистое (`git status` — «nothing to commit, working tree clean»), включая после локальной пересборки `npm run bundle:sync`.
- Коммиты диапазона: `4c9e0132`, `4b27268e` (см. таблицу выше).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/609-ha-form-shell-parity`, коммит `4b27268e2fa7` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `e6ceae417ab48a2f16c3614c949acd96dadb6900`
  ```
  git log --all --format='%H %T' | grep e6ceae417ab4
  ```
- Тело issue: `b08b9257ed688a47f3a0f422cdddc1bfc7cf7c511e81ada3ceeac8c2ce354d51`
- Вердикт конвейера: `yellow` · High 0
