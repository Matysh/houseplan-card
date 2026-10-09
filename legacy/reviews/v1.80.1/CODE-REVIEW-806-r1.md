# CODE-REVIEW-806-r1

Issue: #806 · Трек: ask · Этап: code-review · Заход: r1 · блокирующих циклов израсходовано 0/4
Материал: `git log --oneline origin/dev..HEAD` / `git diff origin/dev...HEAD`
**SHA материала: `7812a26f1837587f985ba779519e2bb409993272`** (рабочая копия на нём; `git rev-parse HEAD` сверен).

## Скоуп

Три коммита на `issue/806-battery-shadow-optout`:

1. `ab9dc1fb` `feat(battery)` — мягкая тень на четырёх MDI-батарейках (#792) + новое
   необязательное поле `Marker.hide_battery`, предикат показа, тумблер в диалоге
   устройства, i18n RU/EN/DE/FR, документация, unit/smoke/pytest.
2. `8a6f523b` `chore(golden)` — приёмка 4 изменившихся golden-сцен
   (`device-battery-board-{light,dark}`, `device-battery-mobile-dark`,
   `device-battery-zigbee-overlap-dark`) плюс побочный сдвиг
   `device-ripple-color-popover-mobile-ru` (layout дернулся новой строкой
   тумблера в диалоге). `Release:`/`Baseline-Reviewed-Local:` трейлеры на
   месте, локальный хеш совпадает с `localAttestation.sha256` индекса.
3. `7812a26f` `fix(schema)` — синхронизация `scripts/config-schema.json`
   (`config.markers[].hide_battery`), не хватавшая в коммите 1; подтверждено,
   что `test/config-schema-parity.test.mjs` без неё красный (ниже).

Риск по участкам из промпта (трек `ask` — проверка «каждый класс покрыт AC ТЗ»):

| Класс | Участок | AC ТЗ | Вывод |
| --- | --- | --- | --- |
| migration | `validation.py:2004`, `types.ts:256` | AC3 («round-trip… schema/config lifecycle») | покрыт |
| perf | `devices.styles.ts:269` (`filter: drop-shadow`) | §8 («целевой browser-smoke… 200 battery-маркеров») | покрыт |
| ux | `marker.hide_battery` в de/en/fr/ru.json:835 | AC3 («RU/EN/DE/FR строки») | покрыт |

ТЗ прошло ревью зелёным на r2 (`docs/reviews/SPEC-REVIEW-806-r2.md`, единственная
находка r1 — незаявленный perf-эффект — закрыта в теле issue перед r2).

## Как проверялось

Validate на `7812a26f` зелёный
(https://github.com/Matysh/houseplan-card/actions/runs/37496793476) —
`typecheck`/`npm test`/`npm run build`+`bundle-policy --verify` приняты без
повторного прогона.

Сверх этого прогнано в этом раунде (гейты по диффу и защитным AC, §8):

| Гейт | Команда | Результат |
| --- | --- | --- |
| Сборка демо-бандла (нужна для смоков, не гейт сам по себе) | `npm run bundle:sync` | OK, `demo/srv/assets` обновлён |
| Целевой смок AC1/AC2 (назван в §8 ТЗ, уже существовал по #792, расширен этой задачей) | `node demo/smoke_device_battery.mjs` | 47/47 проверок `true`, `OK` |
| Целевой perf-смок AC §8, новый файл этой задачи | `node demo/smoke_device_battery_performance.mjs` | `staticMs=540≤3400`, `cameraMs=83≤500`, long-task лимиты (`maxMs≤3000/150`, `count≤30/3`, `total≤12000/300`) выдержаны с запасом; числа лимитов сверены с `demo/performance/budgets-large-house-interaction.json` — те же `hardMaxMs:3400` и `longTaskWindows.cameraSeries` построчно, не изобретены заново |
| Unit (test-build) | `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test test/config-schema-parity.test.mjs test/device-battery-geometry.test.mjs test/device-battery-settings.test.mjs test/device-presentation.test.mjs test/dialog-baseline.test.mjs` | 74/74 + 3/3 + ok, 0 fail |
| `smoke-select.mjs --base origin/dev --head HEAD` | — | даёт только «слабая связь» (45 файлов через общий `_markerDialog`) и «НЕОПРЕДЕЛЁННОСТЬ»; ни `smoke_device_battery.mjs`, ни `_performance.mjs` не всплывают (они сами в диффе — самоссылка не считается). Названные в АС §8 смоки прогнаны напрямую, инструмент это не заменяет |

### Чем краснеет (защитные AC)

| AC | Чем доказан | Чем краснеет |
| --- | --- | --- |
| AC1 (тень формулы, без обрезки, без расширения хитбокса) | `test/device-battery-geometry.test.mjs` (две контрольные точки 19/56 px + монотонность по всему диапазону), `smoke_device_battery.mjs: approvedShadowIsAppliedAtRenderedScale/previewLiveTickAndNoClipping/batteryDoesNotExpandHitCapsule`, golden `prepareBatteryBoard` (бросает `battery golden clipped battery`) | без фильтра `getComputedStyle(icon).filter` вернёт `'none'` — проверка `filter.includes('drop-shadow')` красится прямо в тесте; обрезка панели ловится и smoke-геометрией (`stage`-границы), и golden-throw — явный отрицательный случай в самом тесте, мутант не нужен |
| AC2 (только `true` прячет именно этот маркер) | `test/device-battery-settings.test.mjs` (8 «не-true» входов → показана, `true` → скрыта), `test/device-presentation.test.mjs` (строка `malformedOptOut` с `hide_battery:'true'`), `smoke_device_battery.mjs: localOptOut*` | перепутанный `!==`/`===` или truthy-коэрсия на `'true'`/`1` красит оба unit-теста немедленно — явный отрицательный случай |
| AC3 (строгий boolean, без соседних потерь, i18n) | `tests_backend/test_marker_hide_battery.py` (параметризовано `0,1,None,[],{}` → `vol.Invalid`), `test/config-schema-parity.test.mjs` (историческое свидетельство: коммит 3 добавил запись, которой не хватало после коммита 1 — без неё тест красный, проверено запуском) | voluptuous `bool` = строгий `isinstance`; строковый/числовой вход поднимает `vol.Invalid` — прогнано и подтверждено (см. таблицу выше) |

## Находки

### Medium (в скоупе) — AC1 доказан не для всех заявленных трёх фонов

**Файлы:** `demo/golden/matrix.mjs` (не менялся в этой задаче), `demo/golden/device-battery.mjs`,
`demo/smoke_device_battery.mjs`.

АС1 ТЗ требует доказательства «на светлом, среднем и тёмном фоне» способом
«golden/crop-сравнения двух размеров **и трёх фонов**». Весь golden-харнесс
поддерживает ровно два значения `theme` во всём проекте (`light`/`dark` —
проверено `grep` по `matrix.mjs`, других тем нет нигде). Четыре изменившихся
golden-сцены битвы — `device-battery-board-light`, `device-battery-board-dark`,
`device-battery-mobile-dark`, `device-battery-zigbee-overlap-dark` — дают
только **два** различных фона (light, dark); «mobile» и «zigbee-overlap» — это
тот же тёмный фон на других масштабе/сцене, не третий тон. Коммит-сообщение
`chore(golden)` честно формулирует проверенное как «светлый, тёмный и
**мобильный масштабы**» — то есть автор сам закрывал пункт «два размера», а не
третий фон. Ни один unit/smoke-тест тоже не считает контраст против
промежуточного (среднего) фона — `grep -rni "средн\|medium"` по всем
battery-тестам и golden ничего не находит.

**Сценарий отказа:** если в будущем изменить альфу/цвет тени так, что она
перестанет читаться на фоне средней яркости (например, бежевый/серый план на
фото-подложке — продукт такие планы явно поддерживает), ни один прогон теста,
golden или смока в этой задаче об этом не узнает: оба golden-фона — крайние
значения (чистый светлый/чистый тёмный), а не средний.

Это не блокирует работоспособность кода (High нет), но заявленный в AC1 способ
доказательства не выполнен полностью — это находка в скоупе задачи, не
гипотетическая: достаточно добавить третий вариант фона (например,
нейтрально-серую golden-сцену или `theme`-независимый crop на среднем фоне) или
осознанно сузить AC1 в теле issue и объяснить, почему два фона признаны
достаточными (например, светлый/тёмный — края диапазона, тень линейна по
альфе и контрасту).

## Что проверено и корректно

- Формула тени (`deviceBatteryShadow`) точно воспроизводит утверждённые
  владельцем контрольные точки: на 19 px → `(.7, 1.8, 1.3)`, на 56 px →
  `(1.6, 3.6, 3.2)` (проверено аналитически и тестом); альфа зафиксирована на
  `.75` — это явно разрешённый ТЗ fallback («допустима единая промежуточная
  непрозрачность около .75»), не нарушение.
- Формула продублирована буквально в двух местах — TS-функция
  `deviceBatteryShadow` (используется для расчёта preview-отступа,
  `withDeviceBatteryBounds`) и CSS `calc()` в `devices.styles.ts`. Не единый
  источник, но каждая копия закреплена отдельным тестом с теми же
  утверждёнными числами (`device-battery-geometry.test.mjs` и regex в
  `device-battery-settings.test.mjs`), так что рассинхронизация одной стороны
  красит соответствующий тест. Фиксирую как наблюдение, не как находку:
  блокирующего разъезда при текущем покрытии нет.
- `withDeviceBatteryBounds` резервирует `3×blur` (три сигмы гауссова
  размытия) под тень в preview-fit — не обрезает тень, не двигает shell;
  подтверждено и расчётом, и golden-throw на обрезку, и smoke
  (`previewLiveTickAndNoClipping`).
- Политика показа — `options.showBattery !== false && showMarkerBatteryOf(d.marker)
  && !effectiveHidden` (`device-presentation.ts:760`) — глобальный флаг,
  локальный флаг и lifecycle-гейты независимы и все обязательны, как того
  требует ТЗ §4.
- Один и тот же предикат (`showMarkerBatteryOf`) и один и тот же построитель
  полей (`markerBatteryFields`) используются и при `_saveMarker`, и при
  `_markerDraft` (preview) — нет копирования логики по рендерерам, совпадает с
  §9 ТЗ «единый предикат… не копируется по отдельности». Preview/View/2.5D/
  space-card расходятся через общий `resolveDevicePresentation`, не через
  N независимых копий — тот же архитектурный паттерн, что и у глобального
  `show_device_battery` в #792 (там тоже нет отдельного смока на
  изометрию/space-card для самого флага; #806 унаследовало архитектуру, а не
  ослабило её).
- Backend: `vol.Optional("hide_battery"): bool` — строгий `isinstance`,
  отклоняет `0/1/None/[]/{}` и строки; `support_package._project_marker`
  копирует поле только если `isinstance(…, bool)`, не протаскивая произвольные
  значения в support-пакет вместе с приватными полями. Прочитано построчно
  (локального HA/`voluptuous` нет в этом окружении, выполнить `pytest
  tests_backend` не удалось — см. «чего не проверял»), логика соответствует
  заявленному и backend-тестам, которые её закрывают дословно.
- `scripts/config-schema.json` синхронизирован третьим коммитом;
  `test/config-schema-parity.test.mjs` зелёный сейчас и структурно обязан был
  быть красным до фикса (поле без записи в реестре) — не голословно: тест
  реализует именно такую проверку (`AC4`/`AC7` в самом файле).
- i18n: `marker.hide_battery` присутствует и дословно совпадает с ТЗ в RU/EN
  (`Скрыть отображение заряда на плане` / `Hide battery status on plan`),
  DE/FR — полные локализации, не плейсхолдеры; тумблер лежит в секции
  `card_appearance` («Внешний вид»/«Appearance»), как и описано в
  `USER-GUIDE.ru.md`/`USER-GUIDE.md` этим же коммитом (оба changelog тоже в
  этом коммите, `User-Visible: yes`).
- Трейлеры: все три коммита класса A/B несут `Issue: #806`; `User-Visible: yes`
  только на коммите, который трогает оба `CHANGELOG*`; `Release:` +
  `Baseline-Reviewed-Local:` — только на golden-коммите, хеш совпадает с
  `localAttestation.sha256`; ни один коммит с `Release:` не трогает `src/**`
  или `custom_components/**/*.py` (правило `process-gate` п.6).
- Одно число, один источник (вне тени, разобранной выше): версия
  `v1.80.0-beta.6` в `Release:`-трейлерах не дублируется больше нигде в
  дифф-видимом пользователю тексте (changelog пока в `## Unreleased`).

## Чего не проверял

- `pytest tests_backend/test_marker_hide_battery.py` — не выполнялся: в этом
  окружении нет `.venv-backend` и `voluptuous` не установлен (не облачный
  агент с готовым харнессом). Разобран чтением (см. выше); backend-логика
  простая и прямая, но это не замена исполнения — риск на следующий раунд/
  гейт перед бетой.
- `npx tsc --noEmit`, `npm test`, `npm run build`+`bundle-policy --verify`
  (без сверки копий) целиком не перегонялись — приняты по зелёному Validate
  на точном SHA (см. ссылку выше), это разрешено гейтами §8 при совпадении
  SHA.
- `golden:verify`/`golden:capture` полностью не гонялись (не канонический
  гейт этого раунда; принятие baseline уже прошло отдельным коммитом с
  доказательством локальной аттестации). Сверил только то, что три из
  четырёх принятых сцен действительно относятся к battery/dialog, а не к
  постороннему дрейфу.
- Производительность вне заданного смока (`demo/performance/compare.mjs` /
  полная матрица бенчмарков) — не входит в объём ревью, не названа в AC как
  обязательная здесь; целевой смок прогнан и описан выше.
- Ручного тестирования в браузере (помимо smoke/golden через Playwright) не
  было — визуальную читаемость тени на реальном устройстве не оценивал
  субъективно, только через зафиксированные golden-пиксели и формулу.
- Третий фон для AC1 (см. находку выше) — ничем не проверен, это и есть суть
  находки, а не упущение ревью.

## Унаследовано из предыдущего этапа

Это первый код-ревью раунд (r1) этой задачи; раздел «Унаследовано из r0» не
применим (§2.10 требует его только начиная с r2). Из этапа ТЗ принято без
повторной проверки: весь текст ТЗ, зелёный на `docs/reviews/SPEC-REVIEW-806-r2.md`
(сверено, что тело issue с тех пор не менялось — последний комментарий перед
взятием в работу датирован 2026-10-06T15:40:16Z, до первого коммита в 18:59).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/806-battery-shadow-optout`, коммит `7812a26f1837` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `4e47e228c2b50664137ff3b8fac27a56a08578df`
  ```
  git log --all --format='%H %T' | grep 4e47e228c2b5
  ```
- Тело issue: `78874c4b29e42011cd8d9fc46caaa3ae6df2365f98da3f9b058b1420d2a240de`
- Вердикт конвейера: `yellow` · High 0 · маршрут `fix`
<!-- hp:usage input_tokens=4331 output_tokens=44767 cache_creation_input_tokens=176632 cache_read_input_tokens=7354811 num_turns=69 -->
