# Независимое локальное код-ревью #800 — r2

Вердикт: жёлтый · заход r2 · блокирующих циклов 2/4 · High: 0 · Medium: 1 → в задаче · Low: 0 · маршрут: fix.

## Материал раунда и дельта

- Дата: 2026-10-05; тот же независимый код-ревьюер `/root/code_review_800`.
- Предыдущий отчёт: [CODE-REVIEW-800-r1.md](CODE-REVIEW-800-r1.md), материал
  `379de706d29f4b1547c3b162c1c205654487c6b8`.
- Замороженный материал r2: `4a7abf531bc9bf750073fb7ac7f4a1d9777e83ed`;
  дерево `311dad4c7c6ce782fcc7c8d516b53df0ea8afc6a`.
- Проверяемый диапазон: `git diff 379de706d..4a7abf531` — 19 файлов,
  443 добавленные и 25 удалённых строк, включая сам r1 и перенос preflight.
- HEAD повторно сверён перед вердиктом; продуктовые пути чисты.
  Коммит имеет `Issue: #800`, `User-Visible: yes` и оба changelog.

ТЗ не менялось. Дельта локальна: инвалидирование runtime при reload,
свидетели этого сценария и длительного ожидания, закрытие отказов гейтов и
документации. Нового продуктового скоупа и новой подсистемы нет; применён
PROCESS §2.10. Разрешение локального независимого порядка остаётся
[исключением владельца для #800](https://github.com/Matysh/houseplan-card/issues/800#issuecomment-5998860326).
Ревьюер продукт не правил, мутанты не исполнял, GitHub/ветки/метки не менял.

## Закрытие находок r1

| Находка | Конкретное изменение | Результат |
| --- | --- | --- |
| M1: старый job после reload на живом WS | `zigbee_topology.py:427–431` перед очисткой посылает `closed` со своей сессией и новой revision. `zigbee-topology-runtime.ts:93–103` инвалидирует старые observer/команды/Z2M-cache; явный start повторно открывает feed. HA test теперь подписывается до unload и использует тот же socket после нового setup; четыре unit и новый browser сценарий защищают stale callback/ACK/command | Обычный reload исправлен, но соседний случай раннего повторного нажатия остаётся дефектным — M1 этого раунда |
| M2: виртуальные 15 минут не исполняли asyncio deadline | Backend witness теперь подменяет `hass.loop.time`, продвигает 600 и затем 300 секунд, пропускает callbacks через loop. Мутант `zigbee-background-scan-restores-ten-minute-deadline` возвращает точный `asyncio.timeout(600)` вокруг финального ожидания | Закрыта чтением механизма witness и зелёным HA-прогоном; мутант ждёт ночного исполнения, как требует процесс |
| M3: новые ошибки gate:small | Шесть hooks внесены в `docs/data-hp-contract.json`; `SMOKE_LINKS` снова содержит только frontend `.ts`; preflight сохранён в `docs/analysis/800-spec-preflight.md`, ссылки и generated INDEX согласованы; измеренная база размера обновлена с обоснованием | Закрыта полным зелёным WSL gate на точном SHA |
| L1: устаревшие English guide/STATUS | `USER-GUIDE.md:347` теперь описывает фоновое ожидание, восстановление, отмену после 10 минут и сброс при reload; STATUS описывает #800 вместо прежнего deadline #799 | Закрыта |

Рост `bundleBytes` до 2 697 519 (+11 331 Б, 0,42%) объяснён
[в issue](https://github.com/Matysh/houseplan-card/issues/800#issuecomment-5999301563).
Изменена только измеренная база; пять остальных метрик и допустимые полосы
не менялись. Gzip budgets и lint:unused прошли. Это не ослабление потолков
ради зелёного результата.

## Проверки r2

| Команда / проверка | Результат |
| --- | --- |
| `git diff --check 379de706d..4a7abf531` | PASS, ревьюер |
| `node --test test/zigbee-topology-runtime-routes.test.mjs test/zigbee-topology.test.mjs test/zigbee-provider-routes.test.mjs test/zigbee-topology-style.test.mjs` | 56/56 PASS, ревьюер |
| `node --test test/data-hp-contract.test.mjs test/smoke-select.test.mjs test/reviews-index.test.mjs` | 33/33 PASS, ревьюер |
| `node scripts/mutation-gate.mjs --check` | PASS, ревьюер; прежние 4 предупреждения inventory, мутанты не запускались |
| `npm run gate:small` в новой чистой WSL-копии `/home/matysh/hp800-final-oct5` на `4a7abf531` | PASS, все 9 шагов, 82 с; лог автора `C:/Temp/hp800-gate-small-wsl-r2.log` прочитан ревьюером. Включает build/typecheck, npm test, bundle integrity/budget, no-new-any/private-writes, smoke-select, lint:unused |
| `python -m pytest tests_backend -q --tb=short` в WSL HA harness | 1007 PASS, 1 SKIP, 28 с по результату автора; не pure-only Windows |
| `python -m pytest tests_backend/test_ha_zigbee_topology.py -q --tb=short` | 32 PASS после backend-дельты по результату backend-автора |
| `ruff check custom_components/houseplan`, strict mypy разрешённых 7 модулей | PASS по результатам исполнителей |
| `node demo/smoke_zigbee_topology_job.mjs` | 17/17 PASS по результату автора; теперь включает closed/new-session на том же соединении |
| `node demo/smoke_zigbee_topology_hover.mjs` | PASS по результату автора, fixture wait из r1 теперь в замороженном коммите |
| Production-runtime probe: retry в окне reload | FAIL ожидаемого восстановления, исполнено ревьюером; M1 ниже |

Повторный smoke-select выдаёт те же 14 имён; все решения по каждой строке
унаследованы из r1. Два Zigbee smoke повторены; прочие не стали затронутыми
от добавления `closed` в локальный runtime. Полная предрелизная матрица
этим не объявляется исполненной. Backend/smoke прогоны автора не выдаются
за собственные прогоны ревьюера.

## M1 — временный not_ready во время reload навсегда блокирует явный retry

**Medium, в скоупе AC2/AC4/AC6.** После события `closed` кнопка Update снова
доступна, но новый coordinator может ещё не закончить setup. Если нажать
Update в этом окне, `houseplan/config/get` законно отвечает `not_ready`.
`capability()` (`src/zigbee-topology-runtime.ts:144–151`) сохраняет отвергнутый
Promise в `cache.capability`. Следующее явное нажатие после успешного setup
снова await-ит тот же отказ и вообще не спрашивает backend. События WS `ready`
при reload только интеграции нет, поэтому закрытия одних настроек недостаточно,
если overlay удерживает общий runtime.

Ревьюер исполнил Node-пробу, транспилировав текущий production TypeScript в
памяти без изменения файлов:

1. Подписка и первый start на старой сессии успешны.
2. Принят `closed`; backend временно возвращает `not_ready` на config/get.
3. Явный start даёт `phase:error`, `error:backend_required`.
4. Backend становится доступен с новой сессией; повторён явный start.

Фактический результат после шага 3 **и после шага 4** одинаков:
`config reads = 2`, `server starts = 1`, состояние
`{phase: "error", error: "backend_required"}`. После setup не произошло даже
повторного чтения capability. Пользователь снова вынужден перезагружать страницу.

Нужно разрешить новое чтение capability после временного отказа при следующем
явном действии/восстановлении наблюдения, сохранив отсутствие автоматических
публикаций. Witness должен включать именно промежуточный отказ:
closed → explicit start/not_ready → setup завершён → explicit retry → новая
подписка, один новый scan и успешное принятие результата. Нынешний happy-path
тест делает backend доступным до первого повторного start и этого не ловит.

## Повторно проверенные защиты

| Контракт | Свидетель | Чем краснеет |
| --- | --- | --- |
| AC1: 600 секунд не scan deadline | `test_issue_800_background_15_minutes_two_clients_and_reopen` с продвижением настоящего loop clock | Зарегистрированный `zigbee-background-scan-restores-ten-minute-deadline` |
| AC4/AC6: unload инвалидирует существующий feed | HA same-socket unload/setup; unit `integration closed invalidates mounted jobs`; smoke 17 | `zigbee-background-unload-leaves-ui-waiting`; assertions пустых states/maps и очищенного observer |
| Старый async callback не оживляет сессию | `closed while subscribe ACK is pending`, `only current-session non-stale closed event`, `late command completion from closed session` | Foreign/stale closed игнорируется; старый ACK не закрывает новый feed; старый finally не стирает дедупликацию новой команды |
| Повтор после временного отказа | Независимая production-runtime проба выше | Красный пользовательский исход — единственная Medium этого раунда |

## Унаследовано из r1

Без полного повторного разбора приняты выводы
[r1](CODE-REVIEW-800-r1.md) на `379de706d29f4b1547c3b162c1c205654487c6b8`:
J7 и границы скоупа; дедупликация topic, admin-only, нормализация/пределы,
MQTT transaction и retained guards, last-good/stale, cancel threshold/id/race,
немедленные provider errors, MQTT disconnect, optional MQTT и API floor,
непостоянный runtime без config/export/diagnostics, отсутствие радио retry,
неизменность ZHA/маршрутов/LQI, локали, elapsed formatter и narrow visual QA.
Полные backend и Zigbee unit прогоны повторены, но это не повод выдавать
всё перечисленное за заново проведённое независимое исследование.

Реальная радиосеть, настоящий touch/скринридер, полный golden/performance и
CI кандидата/релизные артефакты не проверялись. M2/M3/L1 закрыты; до устранения
единственной M1 зелёного вердикта нет. Следующий раунд — узкая retry-дельта
плюс затронутые async/ownership сценарии и обязательные дешёвые гейты.
