# Testing

Действующая инструкция: правила для новых тестов, гейты, локальный набор и
матрицы релизной проверки. Ручных чек-листов по поверхностям и приложений по
отдельным issue больше нет (#681, после #634): поведение держат тесты, смоки и
golden, а то, чего автоматика не видит, собрано в разделе
[«Чего не проверяет автоматика»](#чего-не-проверяет-автоматика). Сюда пишется
только то, что действует для любой задачи; маркер `[auto: …]` у пункта обещает
падающую проверку в том же коммите (`docs/DEVELOPMENT.md`).

## Правила для новых тестов (issue #85) — обязательны

Зелёный тест в этом проекте несколько раз означал «ничего не проверено»:
смок непрерывности не заметил удаления механизма, который защищает; golden-сцена,
заведённая под #71, была пустой; смок теней был зелёным, пока тени физически не
рисовались. Общее у всех случаев — **тест ни разу не проверяли на способность
падать**. Отсюда правила.

1. **Наличие атрибута, класса или узла — не проверка поведения.** Такой ассерт
   допустим только рядом с пиксельным либо поведенческим: атрибут доказывает,
   что код выполнился, а не что механизм сработал.
2. **Golden-сцена, заведённая под конкретную задачу, несёт семантический
   ассерт** (`warmPixelRegion` и родственные в `demo/golden/run.mjs`): сцена
   обязана падать, если перестала показывать то, ради чего заведена. Пиксельный
   дифф с эталоном этого не заменяет — пустая сцена совпадает со своим пустым
   эталоном идеально.
3. **Фикстура содержит слои, которые тест защищает.** Смок непрерывности без
   подложки, Glow и декора проверяет пустую страницу; солнце с азимутом, при
   котором луч не достигает единственного окна (#89), — та же ошибка в
   геометрии.
4. **Мутант в `scripts/mutation-registry.mjs` обязателен, когда защита живёт в
   продуктовом коде и проверяется дорогим гейтом** (смок, бэкенд, golden):
   2–5 строк патча, воспроизводящего поломку, против которой тест заведён, и
   тест обязан на ней краснеть. Для чистых юнитов достаточно прогона со снятой
   защитой, приведённого в документе ревью. Правило одно — PROCESS.md §2.7
   (#701); на треке `show` отсутствие мутанта — Low (§10.4).
5. **Тавтологический ассерт — читающий то же свойство, которое код только что
   выставил, — не пишется вовсе.** Он может упасть только при удалении строки,
   но не при её неработоспособности.
6. **Смок входит в сценарий через публичную поверхность** (#629): DOM с
   контрактными хуками (`docs/data-hp-contract.json`), события HA и фикстуры,
   тестовый фасад `window.__hpTest`. Приватное поле карточки допускается только
   для **чтения** в ассертах. Смок, открывший диалог присваиванием
   `c._roomDialog = …`, зелёный и при сломанной кнопке, — это тот же «ничего не
   проверено», что в правилах 1–5. Новые записи держит гейт
   `no-new-private-writes`, остальное — ревью (раздел ниже).

Проверка: `node scripts/mutation-gate.mjs --check` — якоря патчей живы;
полный прогон — workflow `mutation-gate.yml` (шесть чересполосных шардов
`--shard=i/6` — при четырёх шард упёрся в потолок 60 минут, #604; число мутантов
считает `npm run inventory`, а не этот текст;
один зафиксированный commit/tree для всего прогона; каждый артефакт несёт
identity и исход шага прогона, а отдельный агрегатор fail-closed отвергает
смешанные, неполные или прерванные по таймауту evidence даже при частичном
rerun; лог шарда считается зелёным только с итоговой строкой `поймано N из M`)
каждую ночь по расписанию (00:43 UTC); в
релизном гейте он не участвует — проверяет тесты, а не продукт; отказ сам
заводит issue с отчётом (#472, #513). С #620 ночь по расписанию на дереве, уже
доказанном зелёным полным прогоном, шарды не гоняет: зелёный агрегатор
оставляет маркер в кэше Actions (tree материала, `github.workflow_sha`, номер
прогона), следующая ночь с тем же tree и тем же workflow принимает его и пишет в
сводку `reused from run N`. Маркер старше семи суток не принимается (tree
фиксирует код, а не раннер), ручной dispatch гоняет реестр всегда, а красный
прогон маркера не оставляет — следующая ночь гонит реестр заново и снова
заводит issue. Решение — чистая функция `scripts/mutation-nightly-reuse.mjs`
(`test/mutation-nightly-reuse.test.mjs`). Дешёвая половина
идёт с юнитами: `test/mutation-gate.test.mjs`. Для разбора ночного сбоя (не
гейт задачи, #709) — `node scripts/mutation-gate.mjs --changed origin/dev..HEAD`: гоняются только
мутанты, чьи patch-файлы или **входы гарда** задеты диффом (#332, #475, #492).
Входы гарда — это не только файлы, названные в команде: обёртка
(`scripts/*-guard.mjs`) объявляет запускаемые тесты в `export const
GUARD_INPUTS` (умолчание `backend-test-guard.mjs` —
`tests_backend/test_ha_import_export.py`, действует без третьего аргумента), а
от каждого файла гарда берётся замыкание импортов и путей: смок тянет
`demo/serve.mjs`, compat-хелперы и фикстуры, pytest-модуль — `conftest.py`.
`src/**` в замыкание не входит — это сторона патча (§6.4 ТЗ #492). Дифф,
трогающий сам реестр, дополнительно отбирает добавленные и изменённые
определения относительно реестра базы (`git show <base>:scripts/mutation-registry.mjs`;
для commit до #558 используется прежний `scripts/mutation-gate.mjs`). В одном
CLI-вызове замыкание входов вычисляется один раз на уникальную строку guard и
переиспользуется отбором и fingerprint; строка `plan-metrics` показывает число
запросов/вычислений/чтений и время построения плана.
Бандл собирается только мутантам с браузерным гвардом; компиляция тестов в
worktree стартует с тёплого `test-build/` основного дерева.

С #550 ненулевой exit сам по себе не означает «мутант пойман». Цепочка
`setup && ... && oracle` разбирается по шагам: ошибки компиляции, сборки,
загрузки/collection теста дают `setup-failure`; неприменимый патч —
`invalid-mutation`; timeout, signal и отсутствие exit status —
`infrastructure-interruption`; зелёный oracle — `survived`. Только падение
последнего заявленного oracle даёт `assertion-killed` и может попасть в
ledger. Compile-time проверка допустима как самостоятельный свидетель лишь с
явным полем определения `oracle: 'compile'`; прятать её в префиксе обычного
browser/backend guard нельзя. Все недоказанные исходы завершают гейт кодом 2 и
отдельно называются в ночном отчёте. Гвард с `--test-name-pattern`, не исполнивший
ни одного теста, — тоже `setup-failure` ([#650](#пустое-совпадение---test-name-pattern-650)).

С #568 `setup-failure` в дифф-режиме **атрибутируется**: раннер прогоняет
ОПРЕДЕЛЕНИЕ БАЗЫ диапазона на дереве базы и говорит, чей это отказ.
Предсуществующий (не готовится и на базе) гейт задачи не красит — автор не чинит
чужое, — но называется строкой `pre-existing-setup-failures=<id,…>` и обязан
покраснеть в ночном полном прогоне, у которого есть адресат (#472). Отказ,
внесённый диффом, краснит как раньше; свидетеля, которого в базе нет, оправдывать
нечем по построению. Сравнение именно подобного с подобным: с определением из
головы своя же сломанная правка реестра выглядела бы предсуществующей.

Приём, который делает мутанта мёртвым молча, один и тот же: **статически**
мёртвая ветка в `.ts` — `if (false)`, `false &&`, безусловный `return` в начале
функции. TypeScript перестаёт помнить сужения, сделанные выше (`profile` снова
`| null`), компиляция падает до заявленного теста. Писать ложь, ложную в
рантайме, но не статически: `if (eps < 0)`, `String(mode) === 'mutant-never-…'`,
`if (walls.length >= 0) return walls.slice();`. В `.mjs` этого ограничения нет.

**С #709 мутанты в разработке не гоняются вовсе** — ни локально, ни в CI, ни
ревьюером; весь реестр проверяет ночной прогон (`mutation-gate.yml`), выживший
мутант заводит issue. Мутант своей защиты пишется в реестр, якоря сверяет
`mutation-gate --check`; `--id` и `--changed` остаются инструментами разбора
ночного сбоя, а не гейтом задачи. Job `changed_mutants` в Validate не
запрашивает никто (`mutantsRequested` всегда `false`). Ниже — история до #709.

До #709 в CI `changed_mutants` бежал не на каждом пуше, а по явному запросу (#510,
сужено в #601): `workflow_dispatch validate.yml -f mutants=true` (его делали
ревью-конвейер на материале ревью и слияние на кандидате) и PR. `full=true`
(ночь, кнопка), кандидат беты (трейлер `Release:`) и обычный push мутантов не
запрашивают: за 08–09.09 мутанты на промежуточных пушах стоили 48 из 56 часов
job-минут и в основном отменялись следующим пушем, а к бете каждая задача уже
прогнана ими на ревью и на слитом кандидате; ночь покрыта полным реестром
(`mutation-gate.yml`). Доказательство мутантов для ревью — именно dispatch-прогон
на точном SHA; зелёный push-прогон им не является. Релизный гейт mutant-jobs не
требует (`CI_PROOF_POLICIES.release.mutants = false`).

План шарда (`--plan-only`) считается до установки окружения (#518) и с #620
называет окружение своих гардов строками `plan-browser=` и `plan-python=`
(`scripts/mutation-environment.mjs`). Python с зависимостями бэкенда ставится
только шарду с pytest-гардами (в графе исполнения гарда есть `.py` или запуск
`'python3'`/pytest), Chromium — только шарду, чей граф исполнения импортирует
Playwright (смоки, golden, юниты через `demo/serve.mjs`). Граф исполнения — не
замыкание входов для отбора: файлы из строки гарда, объявленные входы обёрток,
пути, названные в этих точках входа, и их относительные импорты. Шард без
таких гардов окружение не ставит, но исполняется и отчитывается — шесть
mutant-jobs в доказательстве ревью (#541) не меняются. Ошибка признака
ложной зелени не даёт: гард без своей среды краснеет уже чистым прогоном.

`changed_mutants` добавляет `--ledger=<файл>` — журнал доказанных
свидетелей (#481, #550): после каждого пойманного мутанта в файл пишутся тип
доказательства (`assertion` или явно объявленный `compile`) и отпечаток
его входов (файлы патча, все входы гарда по замыканию выше, объявление мутанта;
строка версии продукта нормализована), и мутант с тем же отпечатком в следующем
прогоне не гоняется. Схема 2 намеренно не читает старые записи без типа
доказательства: setup failure из прежнего раннера нельзя унаследовать как
зелёный результат.
Журнал живёт в кэше Actions по шарду, сохраняется при любом исходе шага, так
что отменённый пуш или таймаут не пропадают даром. Полный прогон и `--id`
журнал не читают; `--ledger` без `--changed` — ошибка.

## Пустое совпадение `--test-name-pattern` (#650)

Зелёный `node --test` с `--test-name-pattern`, который не исполнил ни одного
теста: TAP называет только сам файл (`ok 1 - test/x.test.mjs`), ассертов не было
ни в чистом прогоне, ни на мутанте. Так бывает, когда задача переименовала тест,
а гвард реестра остался со старым именем. Шаблон — это RegExp: `(`, `+`, `?` в
имени экранируются (в команде гварда `\(отбор\)`, в JS-строке реестра
`\\(отбор\\)`). `mutation-gate --check` проверяет то же статически: шаблон
обязан совпасть хотя бы с одним литеральным именем `test(`/`it(`/`describe(` в
файлах гварда; если в файле есть имена `${…}`, несовпадение — `WARN`, иначе
`FAIL`. Это `setup-failure` (#550) и атрибутируется как любой другой (#568):
переименование теста в задаче даёт `introduced`, старый пустой шаблон —
`pre-existing`. Свидетель — `test/mutation-guard-outcome.test.mjs` (тесты `#650 …`).

## Новый код не добавляет any (#342)

```bash
node scripts/no-new-any.mjs                              # origin/dev...HEAD
node scripts/no-new-any.mjs --base origin/dev --head HEAD
node scripts/no-new-any.mjs --diff patch.diff            # или `-` для stdin
node scripts/no-new-any.mjs --total                      # весь долг src/**
```

Правило — `PROCESS.md` §8 «Новый код не добавляет `any`»: судятся только
добавленные строки, исключение — `// any-ok: <конкретная причина>` на той же
строке, текст разбирает парсер TypeScript. Здесь — только механика: причина
короче 12 символов или из списка заглушек скрипта (`todo`, `hack`, `потом`…) не
проходит; код, дословно перенесённый блоком в другой файл того же диапазона,
новым не считается (#592). В CI гейт вызывается в job `frontend`; её checkout
получил полную историю без блобов, потому что diff-aware проверке нужен
диапазон, а содержимое старых ревизий — нет.

## Тестовый фасад и приватное состояние (#629)

На 22.09 смоки писали в приватное состояние карточки больше двух тысяч раз и
поэтому не видели обработчиков ввода и путей закрытия: шестерёнку, поле имени,
Escape и крестик не нажимал никто. Фасад харнесса `window.__hpTest`
(`demo/helpers/hp-test.mjs`) делает то же, что человек или другой клиент HA.
Он ставится `launch()`, `launchColdView()` и `launchPanelCold()`; смок,
перезагрузивший страницу, зовёт `installHpTestOnPage(page)` заново. Кода фасада в
бандле нет — `window.__hpTest.preinstalled` обязан быть `false`.

| Операция | Что нажимает или шлёт | Готово, когда |
|---|---|---|
| `setMode(m)` | `[data-hp="mode-tab"][data-mode=m]`; для `view` — `[data-hp="editor-close"]` | `ha-card[data-hp-mode=m]` |
| `setTool(t)` | `[data-hp="toolbar"] [data-hp="tool"][data-tool=t]` | кнопка нажата, `updateComplete` |
| `switchSpace(id)` | `[data-hp="space-tab"][data-id=id]` | вкладка `aria-current="page"` |
| `openRoomEdit(roomId)` | `[data-hp="room-settings"][data-room=roomId]` (режим plan) | открыт `[data-kind="room"]`, возвращается он |
| `openMarkerDialog(id?)` | без id — `add-device`; с id — `[data-hp="device"][data-id]` в режиме devices | открыт `[data-kind="marker"]` |
| `openSpaceDialog('create' \| 'edit', id?)` | `space-add` / `create-space`; `space-settings[data-id]` | открыт `[data-kind="space"]` |
| `setServerConfig(next \| fn)` | фикстура `__pushServerConfig`: событие `houseplan_config_updated`, карточка сама читает `houseplan/config/get` | карточка приняла ревизию (тайм-аут 5 с) |
| `setLayout(next \| fn)` | то же через `houseplan_layout_updated` (у карточки дебаунс 200 мс) | ревизия раскладки принята |
| `input(el, text, {clear})` | `keydown` → значение → `InputEvent(insertText)` → `keyup` на символ, в конце `change` | `updateComplete` |
| `close(dialog?, {via})` | `escape` — keydown на активном элементе; `x` — крестик окна; `cancel` — `[data-hp="dialog-cancel"]` содержимого | диалог отсоединён или открыт `[data-kind="confirm"]`; `{closed, confirm}` |

`settled()` — `updateComplete` и два кадра, общий шаг ожидания.

Правила фасада:

- элемент ищется **только** по таблице `SELECTORS`, и каждый её селектор объявлен
  в JSON-контракте с аудиторией `test` (`test/hp-test-facade.test.mjs`). Если
  элемента нет — именованная ошибка с селектором и режимом, без отката на
  приватный метод;
- фасад ничего не пишет в карточку и читает только `_cfgRev`, `_layoutRev`,
  `_serverCfg`, `_layout` — то, что читает и сам продукт;
- `setServerConfig`/`setLayout` означают «план изменили на сервере», а не
  «несохранённая правка»: функциональный аргумент получает `structuredClone`
  текущего конфига карточки. Правку в редакторе смок делает через UI.
  Фикстура, как настоящий сервер, отвечает `conflict` на запись с
  `expected_rev` старше доставленной ревизии — только после первой доставки,
  чтобы смоки без фасада видели прежнюю фикстуру;
- крестик `ha-dialog` HA живёт в его приватном shadow root: `via: 'x'` там —
  ошибка, Escape и cancel работают.

Гейт и счётчик:

```bash
node scripts/no-new-private-writes.mjs                              # origin/dev...HEAD
node scripts/no-new-private-writes.mjs --base origin/dev --head HEAD
node scripts/no-new-private-writes.mjs --diff patch.diff            # или `-`
node scripts/no-new-private-writes.mjs --count                      # остаток на HEAD, не гейт
```

Судятся добавленные строки `demo/smoke_*.mjs` и `demo/helpers/**`. Записью
считаются присваивание любым оператором, `++`/`--` и `delete`, если в цепочке
левой части есть сегмент `_x`: `c._serverCfg.model_version = 7` — запись в
`_serverCfg`, а `window.__card = …`, `o.ok = …` и цепочки от `this` — нет. Вызовы
`._setMode(`, `._openRoomEdit(`, `._openMarkerDialog(`, `._openSpaceDialog(` —
тоже нарушение, с подсказкой операции фасада. Правка строки зачитывается
удалённой записью в то же поле того же файла; перенос непрерывного куска — как
у `no-new-any`. Исключение — на той же строке:

```js
c._drag = { id, sx, sy }; // private-ok: #NNN состояние жеста, операции фасада для него нет
```

с теми же требованиями к причине, что у `any-ok`. Мутации через вызовы
(`c._serverCfg.spaces.push(…)`) и через локальный псевдоним гейт не видит — их
ловит ревью по правилу №6 выше. Гейт идёт в `gate:small` и в шаге job
`frontend` рядом с `no-new-any`, с той же базой.

`HP_SMOKE_CHECKS=1 node demo/smoke_<имя>.mjs` печатает в `finish()`
отсортированный список имён проверок — так перевод смока доказывается «без
потери утверждений»: список до и после сравнивается построчно.

## Локальный набор перед пушем (#343)

Обязательный локальный набор — `npm run gate:small`; его состав живёт в
`scripts/gate-small.mjs` и нигде больше не переписывается (#701). Хук `pre-push`
гоняет его сам для веток задач — таблица «В хуке» ниже. Ручной
`node scripts/pre-push-gate.mjs` из этого раздела — расширенный прогон:
типы, юниты и смоки; мутантов в нём с #709 нет.

Красный CI — дорогой способ узнать о проблеме: пять минут ожидания, а при
код-ревью ещё и лишний раунд. Прецедент назван в задаче: находка r2-H1 в #329
стоила целого раунда и ловилась локальным `npm test`.

```bash
node scripts/pre-push-gate.mjs                       # origin/dev..HEAD
node scripts/pre-push-gate.mjs --base origin/dev --head HEAD
node scripts/pre-push-gate.mjs --no-smokes
node scripts/pre-push-gate.mjs --max-smokes=3
```

Что прогоняется: проверка, что ветка приведена к `origin/dev`, `npx tsc
--noEmit`, `npm test` и смоки, выбранные `scripts/smoke-select.mjs` по диффу.
Мутантов нет (#709); флаги `--no-mutants` и `--max-mutants` приняты для
совместимости и ничего не меняют.

Отставание от `dev` — предупреждение, а не провал набора: гейтом остаётся
конвейер, который приводит ветку сам (#257) и забыть не может. Смысл локальной
проверки в другом: после любого ребейза разбор на ревью становится полным, а не
по дельте (PROCESS §2.10), а конфликт всё равно чинится на машине автора — дешевле
узнать об этом до пуша, чем из комментария через сорок минут (#364). Отключается
флагом `--no-rebase-check`. Замер на реальном
диапазоне (`953f675~1..953f675`, правка `src/houseplan-card.ts`): типы 5 с,
юниты 17–19 с, два смока 22 с — **46 секунд** на всё.

Три свойства, без которых такой набор бесполезен:

- **не останавливается на первом упавшем** — иначе автор узнаёт о втором
  нарушении следующим кругом, то есть ровно то, от чего набор защищает;
- **громко перечисляет, чего не проверял** — молчаливый пропуск дважды стоил
  проекту дня (#171, #207), а «Verified» без названной команды и её результата
  доказательством не является;
- **не претендует на полноту.** Golden, полная матрица смоков, HA-харнесс —
  heavy-набор Validate на кандидате; весь мутационный реестр — ночное
  расписание (#513), а не этот набор.

Бандл не собирается: `bundle-sync.mjs` раскладывает закоммиченный `dist`, а
свежесть проверяет сам продукт — `assertFreshDemoBundle` внутри каждого смока
сверяет вшитый отпечаток с исходниками дерева и скажет, если нужна пересборка.

Лимит по умолчанию — шесть смоков; мутантов ручной режим с #709 не гоняет. Превышение
лимита не проглатывается — набор печатает точную команду для полного прогона.

Три вида ответа `smoke-select` различаются и здесь: дифф без исполняемого кода —
«смоки не требуются»; прямое совпадение или зарегистрированная связь —
прогоняется; **связь не доказана** — отдельная громкая строка, потому что это не
«проверять нечего»: молчание стоило #234 бета-блокирующего регресса. Вместе с ней
печатается визуальный минимум (`VISUAL_MINIMUM` в `scripts/smoke-select.mjs`):
восемь смоков режимов, слоёв и отрисовки, которые `--smokes` гоняет вместе с
выборкой (#690). CSS-правка #687 без него не выбрала `smoke_modes`.

### В хуке — по умолчанию для веток задач (#633)

Прежде набор включался только переменной `HP_PREPUSH_GATE=1`, и ошибки, которые
ловит `gate:small`, находил Validate с конвейером через полчаса после пуша. Теперь
`.githooks/pre-push` сам вызывает `node scripts/pre-push-gate.mjs --hook`, и тот
для каждой пушимой ветки решает:

| Случай | Что делает хук |
|---|---|
| ветка `issue/*`, в диффе от merge-base с `origin/dev` есть хоть один файл не класса C/D | `npm run gate:small` (`scripts/gate-small.mjs --base=<merge-base>`); красный — push отклонён |
| дифф ветки — только класс C/D (документы ревью, changelog, бандл) или пуст | набор не гонится, причина печатается |
| ветка не `issue/*`, тег, удаление | набор не гонится |
| исполняемый дифф, но пушится не `HEAD` | push отклонён: набор проверяет рабочее дерево, а оно не совпадает с пушимым коммитом |
| `HP_PREPUSH_GATE=0` | выключен явно |
| `HP_PREPUSH_GATE=1` | гонится для любой ветки и любого диффа |

Процессный гейт идёт первым — он отвечает за секунды; набор — после, и
прогоняются оба, чтобы все провалы были видны одним кругом. `gate:small` идёт
минуты: в песочнице агента, где команда живёт ≈ 3 минуты, набор гоняют отдельной
командой, а пушат с `HP_PREPUSH_GATE=0` — и пишут об этом в хендоффе.

Ручной режим выше (`node scripts/pre-push-gate.mjs` без `--hook`) остался как был:
tsc, юниты и смоки (мутантов с #709 нет). Решение хука покрыто
`test/pre-push-gate.test.mjs`, включая настоящий `.githooks/pre-push` на
временном репозитории.

Обойти, как и процессный гейт, можно через `git push --no-verify` — и тогда то же
самое найдёт Validate, уже после того как код окажется в `dev`.

## Браузерные проверки до ревью: свежесть бандла и где снимать кадры

- **Смоки из AC — локально до `S7-code-review`** (#151): `node
  demo/smoke_<имя>.mjs`. Красный смок, доехавший до ревью, стоит цикла; на
  своей машине — минуту (на #89 ошибка фикстуры прожила целый раунд ревью).
- **Свежесть бандла** (#236). Отпечаток, вшитый сборкой, покрывает `src/`,
  конфигурацию Rollup и TypeScript и `package-lock.json`; бенчмарки, golden и
  съёмка документации зовут `assertFreshDemoBundle` сами, смоки получают его из
  `launch()` в `demo/serve.mjs`. Несовпадение — жёсткий отказ, а не
  предупреждение: смок на несвежем бандле краснеет частично и читается как
  дефект логики. `HP_ALLOW_STALE_BUNDLE=1` отключает проверку для отладки и
  говорит об этом вслух.
- **Сверять и снимать — разные вещи** (#455). `golden:verify` — совещательный
  и законный где угодно, Windows включительно: он сообщает разницу и ничего не
  принимает. **Съёмка** кадров вне Linux отказывает ещё до запуска браузера —
  `golden:capture` через `demo/golden/policy.mjs`, скриншоты документации через
  `npm run docs:capture` (именно скрипт, не голый `node demo/docs/capture.mjs`:
  правка скрипта съёмки сама обесценивает индекс скриншотов). Причина — физика,
  а не политика: Windows растеризует текст через DirectWrite, и кадр байт в байт
  не совпадёт ни с одним эталоном. Осознанный обход —
  `HP_ALLOW_FOREIGN_CAPTURE="причина"`, причина уходит в вывод и манифест.
  Принимаются эталоны только `npm run golden:accept -- --reviewed` по полному
  артефакту (`demo/golden/README.md`); единственный локальный короткий путь —
  `npm run docs:accept -- --identical` (раздел про версию в кадрах ниже).

## Manifest входов: какие job запускать и что хешировать (#492)

Один модуль, `scripts/check-inputs.mjs`, объявляет каждую проверку Validate
(`preflight`, `frontend`, `changed_mutants`, `integration`, `smoke`, `golden`,
`performance_smoke`, `backend`) через корни и точки входа, а остальное
вычисляет: от точек входа берётся замыкание — импорты транзитивно, строковые
пути как листья, каталог по строке — все текстовые файлы под ним. Из этого
manifest читают и `classify-changes.mjs` (job `changes`: job запускается,
если дифф задел хотя бы один её вход), и `gate-reuse.mjs` (ключ реюза =
хеш содержимого всех входов job). Два места не могут разойтись: до #492 у
бэкенда ключ не знал relay, converter и schema, а golden/perf — `serve.mjs`,
`demo.html` и compat-хелперов.

Правила, которые стоит знать:

- `validate.yml` — вход toolchain каждой job: правка workflow гоняет всё;
- `src/**` — вход только браузерных job, кроме точных cross-runtime входов
  `src/plan-optimizer.ts` и `src/logic.ts`, которые backend pytest читает для
  parity-контрактов; `demo/fixtures/large-house.mjs` и
  `demo/fixtures/visual-matrix.mjs` так же явно входят в backend, потому что
  pytest запускает их через Node dynamic import. Точные исключения не делают
  весь UI или каталог fixtures входом backend (#542); backend от остального UI
  не зависит, а
  `custom_components/houseplan/manifest.json` (версия) держит правило «кандидат
  релиза прогоняет всё» и для него;
- `assets/furniture/**` — вход `frontend` (#671); `assets/fonts/**` — явное исключение ручного `generate-pdf-font.mjs`;
- **неизвестный охраняемый вход** — исполняемый файл под `scripts/`, `demo/`, `test/`, `tests_backend/`, `.github/`, `custom_components/`, `src/` либо tracked-файл под `assets/**`, которого нет в manifest ни
  одной проверки, — расширяет прогон до полного набора и называется
  в summary. Лист покрытия (`node scripts/check-inputs.mjs --coverage`,
  `test/check-inputs.test.mjs`) требует, чтобы каждый такой файл был чьим-то
  входом либо стоял в `NOT_AN_INPUT` с причиной: новый скрипт или asset без записи —
  красный юнит, не вечное расширение прогонов;
- **overlay принятых эталонов** (`demo/golden/baselines/**`, #573) — вход
  только `golden`, у которой он стоит явным корнем. Раскрытие каталога по
  строке его не выдаёт: корпус отпечатка называет `demo/golden` каталогом,
  но берёт из него только `*.mjs`, а до #573 индекс эталонов через это
  раскрытие становился входом smoke, perf и 181 из 183 браузерных
  свидетелей — приёмка 13 кадров на beta.3 (`ad4000f9`) сменила их ключи и
  отпечатки, и второй полный Validate повторил 22 минуты уже сделанной
  работы. Явная ссылка на файл индекса (как в `test/check-inputs.test.mjs`)
  входом остаётся;
- `--check=<job>` печатает входы, `--why=<файл>` — цепочку, по которой файл
  стал входом.

Отрицательные пробы (`test/gate-reuse.test.mjs`, `test/classify-changes.test.mjs`,
`test/check-inputs.test.mjs`) держат представителей каждой категории входов и
обратную пробу для UI ↔ backend; мутанты `manifest-drops-workflow-input`,
`classify-unknown-input-is-unaffected`, `reuse-backend-hashes-ui`,
`backend-dynamic-inputs-dropped`, `baseline-overlay-leaks-into-every-key`,
`guard-inputs-ignore-wrapper-defaults`, `registry-diff-not-selected`,
`merge-pushes-unvalidated-candidate`, `merge-ignores-lease-rejection`,
`nightly-does-not-wait` держат сам протокол.

Чистые Python-контракты канонизации, которым не нужен Home Assistant, находятся
в `tests_backend/test_coordinate_canonicalization_pure.py`. Они обязаны реально
исполняться в локальном `pytest tests_backend`, а не исчезать за module-level
`importorskip`; schema/store/virtual-light проверки остаются в HA-зависимом
`test_coordinate_canonicalization.py`. Поведение static-card capability
доказывается unit/smoke-счётчиками и состоянием runtime, а не regex по исходнику
(#440).

Без установленного Home Assistant (нативная Windows, песочница) HA-харнесс
`tests_backend/test_ha_*.py` **не собирается вовсе** — `conftest.py` исключает
эти файлы через `collect_ignore_glob`, поэтому их нет ни в `passed`, ни в
`skipped`, и зелёная итоговая строка про них ничего не говорит. С #630 pytest в
таком прогоне печатает в шапке и в итоге строку `HA harness NOT collected: N
test_ha_*.py files (M tests)` со ссылкой на канон — Linux CI или WSL
(`bash scripts/wsl-setup.sh --verify`). N и M считаются при каждом запуске по
тому же glob (объявления `def test_*`/`async def test_*`, без размножения
параметризацией), в документах их не переписывают. Проверка —
`tests_backend/test_conftest_harness_notice.py`, мутанты
`ha-harness-notice-silent` и `ha-harness-notice-count-frozen`.

## Версия в кадрах и попиксельная приёмка (#512)

Golden-кадры и скриншоты документации не должны меняться от bump версии. Для
golden отображаемая версия идёт через seam `displayVersion()` (`src/card-version.ts`,
глобальная `__HP_VERSION_OVERRIDE__` — только для харнесов; продукт её не задаёт),
и харнес фиксирует `0.0.0-golden`. Для docs-скриншотов есть локальная приёмка
`npm run docs:accept -- --identical`: кадры сравниваются по декодированным
пикселям, и при полном совпадении обновляется только отпечаток исходников.

## Ядра фронтенда растут только осознанно (#425, заменяет #34)

- [ ] `node --test test/core-file-budget.test.mjs` — потолки на
      `src/houseplan-card.ts` и `src/houseplan-editor-runtime.ts`.

Гейт-храповик с полосой (#699): потолок — факт последней беты, ветка может
вырасти над ним на 50 строк. Если он покраснел, вариантов два, и оба
нормальные — вынести из ядра столько же строк, сколько добавили сверх полосы,
либо поднять потолок отдельным решением, объяснив его в ревью. Молча поднять не
выйдет: число живёт в тесте и попадает в дифф.

Вторая половина правила — выигрыш фиксируется — переехала на бету: без неё
вынос двух тысяч строк ничего не меняет, и ядро дорастает до потолка обратно
«в рамках бюджета». Поэтому на кандидате беты `node scripts/ratchets.mjs
tighten` опускает потолки ядер, графов бандла и базу монолита до факта
(PROCESS.md §8, «Храповики»); ветку задачи уменьшение не красит.

## Локальный CI-совместимый toolchain (#557)

- [ ] `test/toolchain-pins.test.mjs` проверяет, что явно выбранный Python
      используется и для version probe, и для `pip show`, без fallback к
      `python`/`python3`/`py` из PATH; строки результата содержат пути Node,
      Python, Playwright package и Chromium executable.
- [ ] Тот же unit запрещает Windows setup менять persistent PATH или удалять
      существующий venv, требует SHA-256 проверки portable Node и подтверждает,
      что WSL verify запускает настоящий HA subset и одну Linux golden-съёмку.
- [ ] На Windows два последовательных
      `pwsh -File scripts/windows-toolchain.ps1 setup` проходят: первый ставит
      изолированные runtimes, второй переиспользует их; `check` после каждого
      зелёный и печатает фактические версии/пути.
- [ ] Из свежего ext4 checkout WSL команда
      `bash scripts/wsl-setup.sh --verify` проходит `test_ha_setup.py` без skip,
      создаёт непустой `panel-wide-view-light-en.png` и печатает длительность.
      Это ранняя обратная связь; независимый exact-SHA Validate остаётся каноном.

## Backend quality gates (#42)

- `tests_backend/requirements.txt` is the single source of backend CI
  dependencies; `validate.yml` and `mutation-gate.yml` install from it (#392;
  #42 added ruff and mypy).
- `pyproject.toml` configures ruff (`E/F/B/I`, `E501` ignored by decision) and
  strict mypy for a grow-only allowlist of pure modules;
  `tests_backend/test_backend_quality.py` guards completeness. The CI typing step
  derives its module list from that allowlist, refuses an empty list and is
  guarded by a test plus the `typing-gate-stops-running` mutant — a configured
  but unexecuted gate measures nothing.
- `test/backend-test-hygiene.test.mjs` refuses any write into `sys.modules` from
  a backend test by the fact of the write, not its spelling (#398). Exemptions:
  `conftest.py` (stub only when Home Assistant is absent) and `pure_imports.py`
  (registers a module only for `exec_module`, then removes the whole
  `custom_components` difference — proven by an executable test).
- The backend job measures branch coverage (pure + HA harness combined), fails
  below `scripts/backend-coverage-baseline.txt` and refuses to run when the HA
  harness would silently skip.
- The clean-runner `geometry_parity` job (#548) compiles only the TypeScript
  graph rooted at `src/junction-limits.ts`, loads the production Python module
  without Home Assistant and compares both over
  `test/fixtures/junction-limits-parity.json`. It fails closed on missing
  prerequisites, announces the number of executed scenarios and reuses a result
  only when both mirrors, the fixture, toolchain pins and harness inputs are
  byte-identical.
- The error-code scanner proves every emitted code (`send_error` literals,
  exception class attributes, literal and variable-passed `MarkerControlError`
  codes, f-string families) is in `const.ERROR_CODES` / `ERROR_CODE_FAMILIES` and
  localized.

## E2E на реальном Home Assistant (#514)

Репозиторий `Matysh/houseplan-e2e`: настоящий HA в docker, House Plan из
релиза или из дерева коммита, 13 сценариев Playwright (боковая панель,
дашборды, роли, телефон, PDF, рестарт HA, первый запуск, обновление). Ночью —
по расписанию на последней бете; для **стабильного** релиза `release.yml`
запускает его на **SHA кандидата** (`scripts/e2e-gate.mjs --ref=<sha>`, #540:
ставится `custom_components/houseplan` из tarball коммита — то же дерево, из
которого `git archive` строит `houseplan.zip`) и ждёт зелёного: красный —
релиз остаётся черновиком, ассеты не публикуются. В цикле разработки и на
бетах не участвует.

## Environments matrix

Run View/kiosk core flows in every applicable touch environment. Run editor core
flows in desktop environments; touch editors only need the safety floor and
separately promised workflows:

- [ ] Chrome / Edge (desktop, Windows or Linux) — View + all editors
- [ ] Firefox (desktop) — View + all editors; SVG viewBox math and container queries differ historically
- [ ] Safari (macOS) — View + all editors; pointer events / pinch behavior
- [ ] HA Companion app, Android — View only as the parity contract; cold start is mandatory
- [ ] HA Companion app, iOS — View only as the parity contract
- [ ] Tablet in kiosk/panel mode — View/kiosk, landscape, touch gestures
- [ ] Phone portrait, narrow ≤400 px — View and View dialogs/actions
- [ ] Dark theme and light theme (badges, dialogs, plan contrast)
- [ ] RU, EN and DE profile locales (+ `language:` card option forcing each);
      `de-DE`, `de-AT` and `de-CH` resolve to German, while an unknown locale
      falls back to English [unit: i18n, i18n-runtime]
- [ ] German cold start requests exactly one locale chunk, shows only a neutral
      busy frame before commit and never flashes English; a second card reuses
      the page cache. EN/RU request no locale chunk [auto: German locale smoke]
- [ ] German locale download failure retries the content-hashed asset once and
      then unblocks the card in English with one warning [unit: i18n-runtime;
      auto: German locale smoke fault injection]
- [ ] German View and a representative settings/device dialog fit at desktop
      and 390 px without horizontal overflow or clipped actions [golden: German
      desktop/mobile scenarios; auto: dialog footer width at desktop and 320 px]

## Touch support and release gates

The product contract is defined in `docs/TOUCH-SUPPORT.md`:

| Surface | Touch release status |
|---|---|
| View and View dialogs/actions | Required and release-blocking |
| Kiosk/wall tablet | Required and release-blocking |
| Editor entry/exit and no accidental mutation during multi-touch | Safety floor; release-blocking |
| Feature parity of Plan/Device/Background editors | Best effort; not a general release gate |

All editors remain fully tested on desktop with mouse/keyboard. A touch-editor
failure may be accepted only as a deliberate scope change with updated user
documentation and test classification in the same change. “Best effort” cannot
be used to waive data corruption, unsafe service calls, permission failures,
missing destructive confirmation or an editor exception that breaks View.

## Golden-image regression matrix

`npm run golden:capture` records the data-only scenarios from
`demo/golden/matrix.mjs` into ignored `artifacts/golden/actual/`; it never
changes a reviewed image and fails if any scenario itself errors.
`golden:verify` always compares the complete matrix (a diagnostic
`--scenario` is capture-only) with
`demo/golden/baselines/`, writes high-contrast pixel diffs and fails on a
missing image, changed dimensions, excessive diff, scenario error or stale
matrix manifest. It also refuses a different Chromium build and baseline PNGs
whose hashes no longer match the reviewed manifest. `golden:accept --
--reviewed` is the only baseline write path and also requires a complete,
error-free report captured from the current source fingerprint; the entire set
is validated before any reference is copied.

What each scene covers — junctions, boundaries, openings, Glow and sun, fills,
hover, all three editors, themes, zoom levels, warm remount, dialogs — is
declared next to the scene in `demo/golden/matrix.mjs`; semantic assertions
(`enclosedHoles`, `isPointInFill()` containment, opening-symbol contracts) run
before the raster comparison, so a scene fails on meaning before pixels. A
dialog scene whose screenshot shows only a heading instead of the block it
exists for is a scenario error, not an acceptable baseline. In the canonical
Linux CI profile Chromium, viewport, DPR, locale, timezone, colour profile,
font rendering, animations and caret are deterministic. The separate CI job
captures review candidates until the first baseline is accepted; after that it
automatically runs blocking verification. Review and accept the
`golden-images` CI artifact rather than treating a developer OS raster as the
canonical set. See `demo/golden/README.md`.

## Large-house performance gate

`npm run benchmark:large-house` runs a deterministic fictional three-floor
fixture with 60 rooms, 200 devices, 100 openings, 60 partitions, 40 columns and
500 decor objects. It records model readiness, first stable render, space
switch, HA state update, shared-wall resize preview, pan/zoom, settings-dialog render, repeated navigation,
Long Tasks, warmed hot-cache growth and post-GC heap growth.

`Validate` carries a `performance_smoke`: one warm-up and three measured
samples of the heaviest 60-source Glow state. It enforces absolute timing, Long
Task, heap, cache and 200-device ceilings, but does not claim to detect small
relative regressions. Together with the browser smokes and `golden` it runs on
the beta candidate (a head commit with a `Release:` trailer), on the nightly
`full=true` dispatch of `dev` and on pull requests — not on every push (#479).

The dedicated `Full Performance` workflow builds the candidate and base SHA,
then captures seven measured samples for each sequentially on the same Node 22,
Playwright Chromium and hosted runner. It runs on `main`, weekly and by manual
dispatch. `demo/performance/compare.mjs` applies the tighter of the approved
absolute ceiling and baseline-relative allowance. Stable release assets additionally need
an exact-SHA green Full Performance run; every release, including a prerelease,
needs the full exact-SHA `Validate` proof. Raw reports and comparisons are uploaded as CI artifacts, and the check
tables are written to the job summary. Local measurements remain diagnostic.
See `demo/performance/README.md` for commands and the budget-review contract.

## Installation / upgrade / removal

- [ ] A successful entry setup registers `/houseplan` as `houseplan-panel` only
      after store migrations/repairs complete. The panel is visible to admin and
      read-only users; actual editor/write access still follows `can_write` and
      `admin_only` [auto backend: panel registration/permission tests].
- [ ] Missing `houseplan-panel.js`, static registration failure, foreign path
      collision or panel API exception leaves the integration, WS API and
      dashboard card usable. Unload removes only the exact panel object owned by
      this setup generation; reload/reconnect cannot duplicate or delete a
      replacement [auto backend: panel lifecycle + mutation tests].
- [ ] Wide View/editor and 320 px read-only/empty `/houseplan` have no horizontal
      overflow or duplicate product title. Menu activation emits bubbling and
      composed `hass-toggle-menu`; `hass`, `narrow`, `route` and `panel` updates
      preserve one child card; leaving the route keeps only the space and returns
      in View [auto: `smoke_houseplan_panel`; golden: panel matrix].
- [ ] The dashboard full card advertises `{columns:"full",rows:10,min_rows:6}`
      to Sections; the compact card has no grid default. Fixed 6/10/14-row slots,
      all editors and a 30-step storm stay bounded and preserve camera intent;
      other layouts stay unchanged [browser: `smoke_sections_resize`,
      `smoke_houseplan_panel`; unit/mutation: `houseplan-panel`, four grid witnesses].
- [ ] README and User Guide in EN/RU each separate Storage mode, HA 2026.2+
      `resource_mode: yaml` and legacy HA 2024.6–2026.1 full-YAML dashboard
      setup; both hard-reload shortcuts are present and a flat top-level
      `resources:` block is rejected [auto: `check-docs`].
- [ ] Fresh Storage-mode install from the HACS default catalog (plain search)
      → integration appears; the exact `?v=` URL is created or adopted in the
      Lovelace resource registry without an `extra_module_url` fallback or a
      duplicate. An upgrade updates the one canonical entry [auto backend:
      `tests_backend/test_ha_frontend_registration.py`].
- [ ] `single_config_entry`: adding a second entry is impossible [manual]
- [ ] A pending or transient registry installs the fallback immediately, then
      retries exactly once after HA started plus the fixed one-second delay.
      Success removes only this setup's exact fallback when supported; unload
      before the listener, during the delay or during the task prevents all late
      side effects, and reloads do not accumulate listeners [auto backend:
      `tests_backend/test_ha_frontend_registration.py`; mutation gate].
- [ ] HA 2026.2+ YAML resources and a legacy 2024.6–2026.1 full-YAML dashboard
      use the truthful `extra_module_url` fallback without a registry write or
      polling loop. A Storage dashboard is never instructed to switch to legacy
      `mode: yaml` just for House Plan [auto backend:
      `tests_backend/test_ha_frontend_registration.py`; auto: `check-docs`].
- [ ] A missing frontend bundle or failed static-path registration does not fail
      integration setup, does not report a successful loader and does not consume
      the one-time notification; System Health reports file/static/loader/outcome
      honestly [auto backend: `tests_backend/test_ha_frontend_registration.py`,
      `tests_backend/test_ha_setup.py::test_missing_frontend_bundle_does_not_skip_backend_setup`].
- [ ] The first available frontend registration creates one localized persistent
      hard-reload notification. Repeated setup, retry completion and a new House
      Plan version create no duplicate; uninstall dismisses it best effort [auto
      backend: `tests_backend/test_ha_frontend_registration.py`; mutation gate].
- [ ] System Health preserves existing plan statistics and reports card file,
      static path, typed resource outcome, final loader, exact versioned URL,
      retry state, safe error and first-notice state without traceback, tokens or
      external paths [auto backend:
      `tests_backend/test_ha_frontend_registration.py`].
- [ ] In a full card, every successful `config/get` authoritatively replaces the
      backend version. Equal versions and unknown/malformed values show nothing;
      a known symmetric mismatch shows one direction-neutral manual-reload banner
      in ordinary View/editor/dialog states and never reloads without a trusted
      click [unit: `version-recovery`; auto: `smoke_version_recovery`].
- [ ] In kiosk, an unsafe mismatch preserves the current frame. The first fully
      safe idle state stores the backend target before exactly one reload; the same
      target after reload/remount or in a second full card gets no second attempt,
      a new target gets one, and unavailable `sessionStorage` is manual-only
      [unit: `version-recovery`; auto: `smoke_version_recovery`; mutation gate].
- [ ] `custom:houseplan-space-card` loads the shared bundle/config but never owns
      the version banner, safety timer or automatic reload [unit:
      `version-recovery`; auto: `smoke_version_recovery`].
- [ ] Removal deletes every House Plan Lovelace resource entry with the canonical
      base URL and dismisses the notification; `.storage/houseplan.*` survives and
      reinstall picks the old config up [auto backend:
      `tests_backend/test_ha_frontend_registration.py`].
- [ ] Diagnostics download works; personal fields (name/link/description/pdfs) are `**REDACTED**` [manual]

## Edge cases

- [ ] HA instance with zero devices/areas → onboarding works, rooms can be drawn, no crashes [manual]
- [ ] Space with zero rooms → renders; markup hint visible
- [ ] Room without HA area + borders OFF → still has a transparent View hit
      surface, highlights on hover, reports geometric floor area, click does nothing
- [ ] No zigbee devices anywhere → no LQI badges, lqi fill leaves all rooms unfilled [manual]
- [ ] 100+ devices in one space → build under ~50 ms [manual], drag stays smooth
- [ ] Very long device/room names → ellipsis/wrap, no layout explosion
- [ ] HTML/emoji in names (`<b>xss</b>`, 🚿) → rendered as text, never as markup [manual]
- [ ] Plan file deleted from disk → Repairs issue appears after config save/restart; re-upload clears it [auto backend]
- [ ] Corrupted `.storage/houseplan.config` → entry retries (ConfigEntryNotReady), no crash loop [auto backend]
- [ ] HA restart while a dialog is open → next save gets a clean error/conflict, no data loss
- [ ] Legacy layout entries (v1 {x,y} without space) are ignored gracefully
- [ ] Kiosk cold start on mobile app: the card is defined before dashboard
      render; a version mismatch follows the one-safe-attempt contract from the
      installation section instead of flashing or entering a reload loop
      [auto: `smoke_version_recovery`].

## Чего не проверяет автоматика

Сводка того, что удалённые чек-листы `testing-notes/` (#681) помечали
`[manual]` без автоматического свидетеля. Проверяется на кандидате беты руками —
на демо-стенде (`demo/stand/README.md`, там же «чего на стенде нет») или у
владельца:

- **Реальный Home Assistant.** Пользователь без прав администратора не видит «+»
  пространства и шестерёнок (`_canEdit`); мастер импорта этажей на экземпляре с
  настоящими этажами HA (порядок по уровню, Skip/Cancel); фильтрация мостов,
  групп и сцен, нумерация дублей и свёртка групп света на настоящих реестрах;
  лампа, чья сущность скрыта в реестре (свёрнута в группу), переключает и
  показывает лампу; правило card-mod по `data-hp` действует в установленном
  card-mod.
- **Сенсорный экран на устройстве.** Долгое нажатие 600 мс, `pointercancel` без
  фантомной карточки, свайп пространств в киоске, панорама, начатая на значке в
  View, — на планшете или телефоне, не в эмуляции.
- **Ресурсы сервера.** Файл ~50 МБ скачивается дважды параллельно без роста
  памяти HA; перепривязка маркера переносит `/files/<id>/` с PDF; удаление
  пространства снимает предупреждение Repairs о пропавшем плане.
- **Несколько клиентов и представлений.** Статическая карточка на том же
  дашборде следует за перетаскиванием на полной без записи конфига; два
  представления одного дашборда не делят viewport и диалоги; перезагрузка во
  время записи не предлагает «Сохранить» повторно.
- **Визуальная оценка.** Центровка подложки и глифа значка (без сдвига на 1 px),
  читаемость рамок и подписей на белой бумаге, цвета и градиенты заливок
  «Свет», «Температура» и LQI, свет через туннель двери в толстой стене,
  кромка солнечного луча на тёмной сцене (тонкий край, не контур), раскладка
  карточки комнаты.
- **Пользовательское содержимое.** `javascript:` в поле ссылки маркера не
  становится ссылкой.

Остальные пункты с пометкой `[manual]` описывали обычное поведение режимов,
редакторов, диалогов, правил значков и `houseplan-space-card`. Для них нужен
смок, а не ручная проверка: задача, которая трогает такую поверхность без
смока, пишет его в том же коммите (правило `[auto: …]` выше). Оставшиеся пункты
`[manual]` разделов выше остаются как есть.

## Release regression quickies

- [ ] Browser console has zero errors from houseplan-card.js on: dashboard load, markup, dialogs, zoom
- [ ] HA log has zero houseplan errors/warnings after restart
- [ ] `npm test` (frontend), `pytest tests_backend` (pure only without HA: `test_ha_*.py` are not collected, the run prints how many — #630), CI HA-harness — all green
- [ ] README screenshots/GIF still match the current UI (synthetic home only)
