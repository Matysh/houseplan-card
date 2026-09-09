# CODE-REVIEW-485-r3

Issue: [#485](https://github.com/Matysh/houseplan-card/issues/485) — presence-radar
Stage 1. Этап: code (PROCESS.md §2.7). Заход r3, блокирующих циклов израсходовано
2 из 4 до этого раунда (r1 — красный, High 6/Medium 6; r2 — жёлтый, High 0/Medium 3).

Материал: ветка `issue/485-radar-presence`, `git log --oneline origin/dev..HEAD` /
`git diff origin/dev...HEAD`, HEAD = `f474793d9b5fb050be21e2f6273f723fbd009f7a`
("docs: record radar field evidence"), дерево `33297f2255a82b82d99f6269cb38d4f13cd94fe9`.

## Почему разбор полный, а не по дельте (PROCESS §2.10)

Вердикт r2 (комментарий issue) не называет SHA прямо, но документ
`docs/reviews/CODE-REVIEW-485-r2.md` называет его в блоке «Материал раунда»:
HEAD `1e6104100cc76195c3a05aa62e67af84793d9fd1`, дерево `da6ff25c3f68…`.

Оба мертвы в текущей истории: `git cat-file -t 1e610410…` →
`fatal: could not get object info`; `git log --all --format='%H %T' | grep
da6ff25c3f68` → пусто. Это само по себе не находка (§2.10 п.2), но проверка
показала больше, чем обычный мёртвый SHA:

- committer-время **всей** цепочки коммитов ветки, от самого первого
  `cefa557d` (спецификация) до `a2b99e4e` (правки этого раунда), сбито в один
  узкий интервал `02:57:02–03 +0300` 09.09 — признак сквозной переигровки всей
  ветки набором `git rebase`, а не точечного `amend`;
- `git merge-base origin/dev HEAD` = `687056f3` (`ci: check-inputs…`,
  09.09 02:29:08) — это **позже**, чем committer-время r2 (`~00:10` по
  таймстампу issue-комментария вердикта); между r2 и этим раундом `dev`
  реально продвинулся на посторонние задачи (#490, #491, #492, #503 и
  CI-инфраструктуру), а не просто был переpull-ен без изменений;
- пересечение путей `git diff --name-only <dev-до-r2>..<dev-сейчас>` с путями
  ветки радара даёт непустой список, включая **тот самый файл**, где лежит
  находка M-2 из r2: `custom_components/houseplan/websocket_api.py`, а также
  `custom_components/houseplan/__init__.py`, `store.py`, `src/houseplan-card.ts`.

Это прямо названный в процессе триггер («ребейз на ушедший вперёд dev — после
ребейза это другой код»), поэтому ниже — полный повторный разбор, а не только
диффа по находкам r2. Пересечение путей проверено построчно (раздел «Что
проверено» ниже) — конфликтов смысла ребейз не внёс.

## Как проверялось

Прочитан весь diff `origin/dev...HEAD` (118 файлов) и построчно — фактический
новый код раунда, коммит `a2b99e4e` («fix: close radar review gaps»,
`8dec5be0` — только отпечаток скриншотов, `f474793d` — docs-only). Каждая
находка r1 и r2 перепроверена по актуальному коду (таблица «Закрытие раунда
r2» ниже), с точечным чтением на пересечённых с `dev` файлах.

**Прогнанные гейты:**

| Гейт | Результат |
|---|---|
| `npx tsc -p tsconfig.test.json` / `npm run build` (`tsc --noEmit && rollup`) | зелёные |
| `node --test test/*.test.mjs` (весь фронтенд-набор) | 2370 passed, 1 skipped, 0 failed (2371 всего) |
| `npm run bundle:sync` | дерево `dist` → `custom_components/houseplan/frontend` → `demo/srv/assets` синхронизировано, `git status` чист до и после — бандл воспроизводим побайтно |
| `npm run bundle:budget` | 0 (initial View 298 481 Б / потолок 299 000; предупреждение о запасе — унаследованный долг #367→#474, не новый в этом раунде) |
| `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | «Новых any нет» (2078 строк / 14 файлов) |
| `node scripts/check-docs.mjs` | «Documentation checks passed» — отпечаток скриншотов актуален после `8dec5be0` |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 60 прямых совпадений + 1 зарегистрированная связь — см. обоснование ниже |
| `node demo/smoke_radar_setup.mjs` | OK, все поля отчёта `true` |
| `node demo/smoke_radar_live.mjs` | OK, все поля отчёта `true` |
| `python3 -m pytest tests_backend/ -q --ignore-glob='*/test_ha_*'` (чистый Python 3.12 + `pip install pytest voluptuous`, без HA) | **451 passed, 4 skipped** — включает весь `test_radar_geometry.py` (14/14) и весь `test_radar_validation.py` (42/42) |
| Ручная мутация трёх ранее непокрытых гвардов решателя (M-1 из r2): снятие дистанции ≥50см, RMS≤20/индивид.≤30, неоднозначности зеркала <10см | все три — **красные** (`DID NOT RAISE`) на соответствующих новых тестах `test_radar_geometry.py::test_two_point_fit_enforces_reference_distance_and_rms_guards` / `test_two_point_fit_rejects_ambiguous_mirror_candidates` |
| Ручная мутация четвёртого гварда — `radial_ok`/`radialOk` (backend и frontend) | **не красит ни один тест** — новая находка M-1 (см. ниже) |
| `node --test test/i18n-dead-keys.test.mjs test/i18n.test.mjs test/single-source-numbers.test.mjs` | 28/28, 3/3 — зелёные |
| Проверка ключей i18n `en/ru/de/fr` (`node -e` обход дерева) | 1363/1363 ключей, 0 расхождений во всех трёх переводах |
| `git diff --check` | чисто |
| Трейлеры (`git show -s --format=full`) трёх новых коммитов раунда | `Issue: #485` на всех; `a2b99e4e` — `User-Visible: yes` + правки `docs/CHANGELOG.md`/`.ru.md` в том же коммите; `8dec5be0`/`f474793d` — `User-Visible: no` |
| `npm run invariants` | не запускался — diff не трогает рёбра комнат/толщину/`layout`/`marker.space`/`open_spans` (`grep` по всем изменённым backend/frontend radar-файлам — 0 совпадений; `radar.room_id` только ссылается на существующую комнату) |

CI Validate на точном SHA `f474793d` **на момент написания документа не
завершён** (запуск `34293375714`, стартован автором): фронтенд/HACS/hassfest/
2 из 3 job «Мутанты по диффу» зелёные, `backend`/`perf`/`golden`/`смоки` ещё в
очереди. Не дожидался — гейты выше воспроизведены самостоятельно, а
эволюция того же прогона не меняет уже увиденный код.

## Находки

### High — нет

### Medium (в скоупе задачи — чинится в этой же ветке)

**M-1 (новая). Четвёртый числовой гвард двухточечного решателя —
согласованность радиальной дистанции — не покрыт ни одним тестом ни в
backend, ни в его TS-двойнике, и это не теоретический, а конкретно
воспроизводимый пропуск.**

`custom_components/houseplan/radar_geometry.py:196-197` (симметрично
`src/radar-geometry.ts` — `radialOk`, строки 70-74) требует, чтобы для каждой
референсной точки радиальное расстояние от датчика совпадало с ожидаемым
(вычисленным по плану) в пределах `max(20см, 15% от ожидаемого)`. Это ЧЕТВЁРТЫЙ
из четырёх гвардов, которые сам документ r2 перечислил как «несёт четыре
защиты» — но фикс M-1 из r2 (`a2b99e4e`) добавил тесты только на три
(дистанция ≥50см, RMS/индивидуальная ошибка, неоднозначность зеркала); заявление
r2 «Симметричная TS-реализация... все четыре гарда покрывает» неточно — её
`radialOk` тоже не тестируется отдельно.

*Проверка (снятие гварда не красит ни один тест):*
```
python3 -m pytest tests_backend/test_radar_geometry.py tests_backend/test_radar_validation.py -q
# с изменённым radar_geometry.py: `if radial_ok and rms <= 20 and max(errors) <= 30:`
#                              → `if rms <= 20 and max(errors) <= 30:`
# результат: 14 passed / 42 passed — без единого падения
```
Тот же результат для `src/radar-geometry.ts` (`radialOk &&` вырезано):
`node --test test/radar-geometry.test.mjs test/radar-setup.test.mjs
test/radar-editor.test.mjs test/radar-model.test.mjs test/radar-render.test.mjs`
→ 28/28 без изменений.

*Это не редундантный гвард — конкретный воспроизводимый случай, который он
один и ловит:* локальные точки `(100,0)` и `(0,100)` (валидный угол 90°),
целевые точки на плане — для второй референс идеален, для первой радиальная
дистанция сознательно завышена на 25 см (`(125,0)` вместо `(100,0)`, то есть
пользователь верно взял направление, но неверно — расстояние). Результат
незеркального решения: `rms_cm ≈ 17.68` (≤20 — проходит), `errors_cm =
[25.0, 0.0]` (оба ≤30 — проходит), но `radial_ok = False` (диапазон допуска
20см, разница 25см) — сейчас это **правильно отклоняется** как
`invalid_selection`; без гварда калибровка была бы принята с сообщением об
успехе и `rms_cm≈17.68`, то есть пользователь получил бы «хорошую» по RMS
калибровку с реально неверным расстоянием эталона — ровно тот класс ошибки
(верное направление/неверное расстояние), который field-данные автора запроса
(раздел «Полевые данные», п. 11) описывают как источник необнаруживаемого на
глаз смещения. Доказательство — арифметическое: `|hypot(local) −
hypot(target)| ≤ euclidean_error` (обратное неравенство треугольника, поворот
сохраняет норму), поэтому радиальная ошибка ограничена сверху потолком
индивидуальной ошибки (30см) — окно `(20см, 30см]` для близких точек (где
`15%·ожидаемое < 20`) реально достижимо и не отсекается двумя другими
гвардами. Не имитация, а математически гарантированно непустой класс входов.

*Почему Medium, а не High:* сам гвард в продуктовом коде уже есть и сейчас
работает правильно — это пробел в тестовом покрытии (риск тихой регрессии
при будущем рефакторинге того же файла), а не действующий сегодня дефект.
Чинится добавлением ровно такого теста на обеих сторонах (backend +
`test/radar-geometry.test.mjs`) в этой же ветке.

## Закрытие раунда r2

| Находка r2 | Чем закрыта | Где видно |
|---|---|---|
| M-1 (продолжение M6 r1) — 3 из 4 числовых гвардов решателя не тестированы | `tests_backend/test_radar_geometry.py::test_two_point_fit_enforces_reference_distance_and_rms_guards` (дистанция, RMS/индив. ошибка) и `::test_two_point_fit_rejects_ambiguous_mirror_candidates` (зеркало); зеркальный TS-аналог в `test/radar-geometry.test.mjs:40-58` | Подтверждено ручной мутацией всех трёх защит — каждая красит ровно свой новый тест (см. таблицу гейтов). **Четвёртый гвард (`radial_ok`) этим фиксом не закрыт — новая находка M-1 выше** |
| M-2 — `radar_stage1_api` объявлялся константой независимо от состояния координатора | `custom_components/houseplan/websocket_api.py:1460` — `**({"radar_stage1_api": 1} if rt.radar_coordinator is not None else {})` вместо безусловного `1` | Прочитано по коду; новый HA-тест `tests_backend/test_ha_websocket.py::test_config_get_advertises_radar_only_while_coordinator_is_ready` переключает `runtime.radar_coordinator = None` и обратно, проверяя исчезновение/появление ключа — тест не запущен лично (HA недоступна в песочнице ревью, см. «Чего не проверял»), но прочитан и логически годен как «чем краснеет» |
| M-3 — `radar.bad_references` объявлен, но недостижим; неоднозначная и «близко к монтажу»/коллинеарная ошибки схлопывались в общее `bad_fit` | `src/radar-geometry.ts:47,53` теперь бросает `'bad_references'` для дистанции <50см и коллинеарного угла (было `'invalid_selection'`); `src/radar-setup.ts:333-334` маппит `'bad_references'` → `'radar.bad_references'` отдельно от `'radar.bad_fit'` | `test/radar-geometry.test.mjs:37,45` (`/bad_references/` вместо `/invalid_selection/`) и новый `test/radar-setup.test.mjs` тест «calibration reports bad reference placement separately from a measurement mismatch» — прогнаны лично, оба зелёные; RMS-провал по-прежнему даёт `radar.bad_fit` отдельно (та же проверка) |

Все 6 High из r1 подтверждены присутствующими в текущем (пост-ребейз) коде
построчным чтением на тех же местах, что называл документ r2 (health
`partial`/`stale` — `radar.py:552-554`; teardown/lock — `radar.py:106-151`;
same-device LD2450 — `radar_validation.py:147-180`, дополнительно
перепроверено прогоном 42/42 в `test_radar_validation.py`; zones render —
`radar-render.ts:18-24`; `radarAfterBindingChange` —
`radar-editor.ts:65-75`/`houseplan-editor-runtime.ts:13015,13071`) — ребейз не
затронул ни один из этих файлов посторонними изменениями из `dev`.

## Что проверено сверх таблицы закрытия

- **Пересечение путей ребейза с веткой радара безопасно.** `dev` продвинулся
  на `src/houseplan-card.ts` (несвязанная правка #490 — восстановление
  `_capturedSnapshotSequence`/сбор `entityIds` сводной панели, другие строки),
  `custom_components/houseplan/__init__.py`/`store.py` (рефакторинг
  восстановления прерванной парной записи, #491) и
  `custom_components/houseplan/websocket_api.py` (та же строка, что правит
  M-2 этого раунда). Порядок вызовов не изменился: `radar_coordinator =
  RadarCoordinator(...); await async_setup()` по-прежнему стоит **до** блока
  восстановления прерванной пары (`async with data.write_lock:
  async_resolve_pending_pair(...)`) — так было и до ребейза (радар всегда
  инициализировался раньше этого блока в r1/r2 коде), это не новый риск.
  Радар получает свежие данные после восстановления через уже существующую
  подписку на `houseplan_config_updated`, которую сам блок восстановления и
  генерирует при `optimize_revs is not None`.
- **i18n-структура заново пересчитана, не унаследована с доверием**: обход
  дерева всех четырёх словарей построчно (`node -e`) — 1363/1363 ключей,
  0 расхождений `ru`/`de`/`fr` от `en`.
- **Трейлеры и changelog** обоих `User-Visible`-коммитов раунда проверены
  форматом `git show -s --format=full`.
- **Backend вне HA-харнесса зелёный практически полностью**: в отличие от r2
  (которая не смогла запустить ни одного backend-теста в песочнице), в этой
  песочнице системный Python 3.12 уже нёс рабочий `sqlite3`; после `pip
  install pytest voluptuous` весь `tests_backend/`, кроме файлов
  `test_ha_*.py` (жёстко пропускаемых без пакета `homeassistant` самим
  `conftest.py`), прогнан лично — 451 passed. Это заметно сильнее прежнего
  раунда: `test_radar_validation.py` (42, включая H3 same-device) и
  `test_radar_geometry.py` (14, включая новые M-1-из-r2 тесты) выполнены, а
  не только прочитаны.
- **Один источник числа**: новая правка (`a2b99e4e`) не добавляет ни одной
  новой отображаемой величины — только маршрутизацию сообщений об ошибке и
  видимость булева капабилити; регрессии класса #234/#233 не создаёт.
  `test/single-source-numbers.test.mjs` — 3/3.
- **`smoke-select` даёт 60 «широких» совпадений** — это артефакт полного
  диффа `origin/dev...HEAD` (вся ветка целиком, как и в r2), а не нового
  кода этого раунда: символы `_markerDialog`/`_editorRuntime`/`_mode`/
  `_cfgRev`/`cellCm` происходят из уже провёренных в r1/r2 файлов
  (`marker-dialog-close.ts`, `houseplan-editor-runtime.ts`), которые
  фактический дифф `a2b99e4e` не трогает вовсе (он меняет только
  `radar-geometry.ts`/`radar-setup.ts`/`websocket_api.py`/тесты). Прогнаны
  два **прямых** совпадения, специфичных для радара
  (`smoke_radar_setup.mjs`, `smoke_radar_live.mjs`) — оба зелёные; остальные
  58 широких совпадений и 1 зарегистрированная связь (`smoke_dialog_modal_recovery.mjs`)
  относятся к коду диалога, который этот раунд не менял и который r2 уже
  прогнала прицельно (`smoke_marker_stay`, `smoke_dialog_zombie`,
  `smoke_new_device`, `smoke_toggle_entity` — все зелёные в r2, код с тех пор
  не менялся).

## Чего не проверял

- **`python -m pytest tests_backend/test_ha_radar.py
  tests_backend/test_ha_radar_websocket.py tests_backend/test_ha_websocket.py
  -q` (HA-харнесс) лично не прогонял.** В песочнице ревью нет ни установленного
  `homeassistant`, ни `.venv-backend`; `tests_backend/requirements.txt`
  требует Python ≥3.14 для `pytest-homeassistant-custom-component`, в
  песочнице — 3.12. Здесь же лежат H1/H2/H3(частично)/H6 из r1 и новый тест
  M-2 этого раунда. Опираюсь на: (а) построчное чтение каждого — включая
  новый `test_config_get_advertises_radar_only_while_coordinator_is_ready`,
  который реально переключает `radar_coordinator` на `None` и обратно, а не
  просто спрашивает поле; (б) автор в issue сообщил результат «180 passed» в
  WSL/HA на этом же SHA (`5590037034`) — это заявление автора, а не
  независимое доказательство, поэтому не заменяет проверку; (в) CI Validate
  на этом SHA (`34293375714`) стартован, но job «Бэкенд» ещё не приступал на
  момент публикации документа. **В отличие от r2, у этого раунда пока нет
  готового зелёного Validate, на который можно сослаться как на замену
  прогону** — если к моменту слияния job «Бэкенд» на `f474793d` окажется
  красным, это отменяет вердикт независимо от прочтения кода.
- **Полный `demo/smoke_*.mjs` (234 файла)** не гонял — обоснование выбора двух
  прямых радар-смоков и опоры на уже прогнанные в r2 нерадарные смоки диалога
  — раздел «Что проверено» выше. Полный матрикс — предрелизная обязанность
  (PROCESS §8).
- **`npm run golden:verify`** не прогонял — diff этого раунда не трогает
  рендер (только сообщения об ошибке и видимость капабилити); r2 уже
  зафиксировала отсутствие golden-сцен для радара вообще (Low, не растёт до
  Medium третий раз подряд по той же логике: защитные утверждения уже
  доказаны прицельными негативными тестами).
- **Perf-профили** — не запускал, diff не касается `iso-*`/`live-*`/
  `render-*`/`houseplan-render-lifecycle.ts`, AC этой стадии не называют
  perf-профиль отдельным доказательством.
- **`node scripts/mutation-gate.mjs`** не запускал локально — CI-джобы
  «Мутанты по диффу» уже покрывают ровно эту роль для реального диффа против
  `dev`; 2 из 3 job зелёные на момент документа, третья не завершена. Ручная
  мутация гвардов решателя (таблица гейтов, находка M-1) — независимая
  подмена того же по духу свидетельства для мест, которые diff-скоуп
  инструмента мог не задеть (`radial_ok` не находится на изменённых
  диффом `a2b99e4e` строках).

## Итог

0 High. 1 Medium в скоупе — новая находка M-1 (четвёртый гвард
`solve_two_point`/`solveRadarTwoPoint`, `radial_ok`/`radialOk`, не покрыт ни
одним тестом ни в backend, ни во фронтенде; воспроизведён конкретный входной
случай, который гвард сегодня корректно отклоняет, а без теста будущий
рефакторинг может тихо снять). Все три Medium из r2 (M-1 продолжение M6,
M-2 капабилити `radar_stage1_api`, M-3 мёртвый `radar.bad_references`)
закрыты предметно и подтверждены прогоном (кроме HA-зависимой части M-2,
проверенной чтением — см. «Чего не проверял»). Все 6 High из r1 подтверждены
присутствующими после ребейза. Вердикт — жёлтый: без High это возврат
автору на один точечный тест-фикс (backend + TS) по уже существующему,
корректно работающему гварду, не по архитектуре.

<!-- material-anchors: заполняется конвейером публикации -->

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/485-radar-presence`, коммит `f474793d9b5f` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `33297f2255a82b82d99f6269cb38d4f13cd94fe9`
  ```
  git log --all --format='%H %T' | grep 33297f2255a8
  ```
- ТЗ `docs/specs/485-radar-presence-stage1.md`, блоб `322f040bfcfdba41802caad302da99188ab9d710`
  ```
  git log --all --find-object=322f040bfcfdba41802caad302da99188ab9d710 -- docs/specs/485-radar-presence-stage1.md
  ```
- ТЗ `docs/specs/485-radar-presence-stage2.md`, блоб `b403e73fc26ba0ffb97be4ffa73be067d179880f`
  ```
  git log --all --find-object=b403e73fc26ba0ffb97be4ffa73be067d179880f -- docs/specs/485-radar-presence-stage2.md
  ```
- ТЗ `docs/specs/485-radar-presence-stage3.md`, блоб `c65e28389d762216c47f00249bdb751f3c9d5082`
  ```
  git log --all --find-object=c65e28389d762216c47f00249bdb751f3c9d5082 -- docs/specs/485-radar-presence-stage3.md
  ```
- ТЗ `docs/specs/485-radar-presence.md`, блоб `3297ed0140265ad86f2072a40cb9bf8097c0674d`
  ```
  git log --all --find-object=3297ed0140265ad86f2072a40cb9bf8097c0674d -- docs/specs/485-radar-presence.md
  ```
- Вердикт конвейера: `yellow` · High 0
