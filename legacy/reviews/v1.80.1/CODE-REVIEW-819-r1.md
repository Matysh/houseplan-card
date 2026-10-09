# CODE-REVIEW-819-r1

Issue: #819 · Этап: code · Трек: ask · Заход: r1 · блокирующих циклов 0/4
Материал: `git diff origin/dev...HEAD`, SHA `ccb2ad31bc3d7a40d450e2290ccbfea9c1b2124f`
(рабочая копия на этом SHA весь прогон; никаких fetch/checkout на другой коммит не делалось).

## Скоуп

Issue #819: «Удалить» у пространства с активными устройствами перестаёт
молча проваливаться за край диалога — тело диалога прокручивается к
предупреждению и переводит на него фокус, а в предупреждении появляется
кнопка «Удалить пространство вместе с устройствами». Контракт (п. 1–6) и
AC1–AC6 — из тела issue, решения владельца от 2026-10-07 (устройства
удаляются как кнопкой «Удалить» в диалоге устройства; скрытые входят в
число; одно обычное окно подтверждения без отмены после записи).
SPEC-REVIEW-819-r2 — зелёный (найденный в r1 Medium про разделы «риски»/
«откат» закрыт).

Два коммита в материале:
1. `7eb9929b` feat(ws): удаление пространства вместе с блокирующими
   устройствами (Python, `User-Visible: no`).
2. `7b84e105` feat(space): прокрутка к блокировке, кнопка и подтверждение
   (фронт, `User-Visible: yes`, CHANGELOG RU/EN в том же коммите).

Трейлеры `Issue: #819` и `User-Visible` на месте на обоих коммитах; при
`yes` — оба changelog действительно в том же коммите (проверено `git show
7b84e105 --stat`).

## Как проверялось

Прочитан построчно весь `git diff origin/dev...HEAD` (23 файла): оба
коммита, бэкенд (`websocket_api.py`), оба фронтовых слоя
(`space-deletion.ts`, `houseplan-editor-runtime.ts`,
`houseplan-onboarding-runtime.ts`, `editors/space-form.ts`,
`editors/form-kit.ts`), i18n (4 каталога), оба USER-GUIDE, оба CHANGELOG,
`ARCHITECTURE.md`, тесты (`tests_backend/test_ha_websocket.py`,
`test/space-deletion.test.mjs`), общая фикстура
`test/fixtures/space-delete-with-markers.json`, реестр мутантов, инвентарь
гардов, `smoke-links.mjs`.

Прослежены сквозные пути:
- Python: `_space_marker_dependencies` → `_delete_plan_markers` →
  `_space_delete_target` → `ws_space_delete` (единственный `_commit_pair`,
  `_forget_deleted_markers` под тем же `write_lock`, ревизии, конфликт,
  последнее пространство).
- TS: `collectSpaceMarkerDependencies` / `deletePlanMarkers` /
  `createSpaceDeletionCandidate` (используется только в тестах — паритетный
  мираж сервера, не продуктовый путь) и продуктовый путь
  `houseplan-editor-runtime.ts::_deleteSpace` (возврат по блокировке,
  подтверждение, повторная сверка зависимостей после подтверждения,
  отправка `remove_markers`, обработка `conflict`/`space_in_use`).

### Гейты

| Гейт | Статус | Результат |
|---|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build` + `bundle-policy --verify` | не перегонял — Validate на этом SHA зелёный | https://github.com/Matysh/houseplan-card/actions/runs/37650192504 (job «Фронтенд: типы, юниты, мутанты, синхрон бандла» = success) |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | прогнал сам | 12 прямых совпадений + 15 слабых связей (27, как в отчёте автора); список свёл к новому смоку и части прямых |
| `node demo/smoke_space_delete_with_devices.mjs` на HEAD | прогнал сам | 31/31 OK (оба вьюпорта, 1000×700 и 375×812) |
| тот же смок на `origin/dev` (во временном `git worktree`, без изменения рабочей копии) | прогнал сам | 10 красных: `blockScrollsTheWarningIntoView`, `blockFocusesTheWarning`, `repeatAfterManualScrollRevealsAgain`, `warningOffersDeleteWithDevices`, `buttonDisabledWhileBusy` ×2 (десктоп+телефон) — ровно то, что заявил автор |
| 2 из 11 мутантов реестра (`space-delete-block-stays-out-of-view`, `space-delete-with-devices-ignores-a-moved-plan`) — ручной патч/прогон/откат во временном `git worktree` | прогнал сам | оба CAUGHT: первый роняет 6 проверок (включая оба вьюпорта), второй — ровно `changedPlanUnderConfirmationDeletesNothing` |
| `pytest tests_backend` (`test_ha_websocket.py`, новые тесты AC2/AC4/AC5) | **не прогнал** | в песочнице нет `homeassistant` (даже импорт `websocket_api.py` падает `ModuleNotFoundError`), а пин требует Python 3.14 (песочница — 3.12.3); CI-джоб «Бэкенд: pytest в Home Assistant» в Validate-прогоне `37650192504` — `skipped`. Разобрано чтением кода (см. ниже), не исполнением |
| `mutation-gate --check` / инвентарь гардов | не перегонял | числа в `docs/testing-notes/mutation-browser-guards.md` (267/41/119) совпали со строками, добавленными в диффе — сверено построчно |
| golden, инварианты геометрии, performance | не применимо | диффа в геометрии/рендере плана нет (только callout/кнопка/текст), `ci:golden` не стоит |

Разметка «чего не проверял» — ниже отдельным разделом, как требует формат.

## Разбор по AC

**AC1 (прокрутка и фокус).** `revealSpaceDeleteBlocker`
(`src/editors/space-form.ts:74-80`) — общий хелпер для обоих рантаймов:
`scrollIntoView({ block: 'nearest' })` + `focus({ preventScroll: true })`
после `updateComplete`; у `callout` — `tabindex="-1"` через новую опцию
`focusable` (вне Tab-порядка, подтверждено в `form-kit.ts`). Вызывается в
трёх точках `_deleteSpace` (первая блокировка, повтор после подтверждения,
после ошибки сервера) — построчно сверено в
`houseplan-editor-runtime.ts:8272-8374`. Доказано исполнением: смок на
HEAD — 31/31, на dev — ровно 10 красных по тем же именам проверок
(scroll/focus/repeat/button/busy, оба вьюпорта). «Чем краснеет» —
мутанты `space-delete-block-stays-out-of-view` и
`space-delete-block-leaves-focus-behind`; первый проверен мной вручную
(CAUGHT).

**AC2 (кнопка, подтверждение, одна запись).** Кнопка рендерится только
когда `port.deleteSpace` задан (`space-form.ts:166-169`) — у онбординга он
не задан (см. «Отступления» ниже). Подтверждение — тот же `_confirmDanger`
с расширенным текстом (`N`, при `K>0` — отдельная строка) только когда
`removeMarkers` истинен; без устройств или на последнем пространстве текст
прежний (`houseplan-editor-runtime.ts:8295-8307`). Сервер:
`_delete_plan_markers` (`websocket_api.py:1915-1974`) — построчно
воспроизводит семантику одиночного удаления маркера (`_delete_plan_markers`
в Python зеркалит `deletePlanMarkerRecords`/`removeMarkerControlReferences`
из `src/devices.ts`/`space-deletion.ts`): для реальной привязки удаляет все
маркеры той привязки и оставляет один tombstone
(`removed: True, hidden: True`); виртуальный — просто исчезает; следом
чистит `controls` с префиксом `marker:`, LED-ленты (`marker: None, active:
True`), `marker_area_snapshot`, позиции в layout. Все эти правки происходят
**внутри одного** `_space_delete_target` → один `_commit_pair`
(`websocket_api.py:2104-2120`) — атомарность подтверждена чтением (нет
промежуточного awaited commit между вычислением кандидата и записью) и
тестом `test_issue_819_space_delete_with_markers_is_one_authoritative_write`
(ревизии +1/+1 ровно один раз, `service_calls == []`). Фикстура
`test/fixtures/space-delete-with-markers.json` пином проверяет граничные
случаи: дубль привязки (`by_space`/`lamp_twin` — обе уходят, один
tombstone), скрытый маркер, виртуальный маркер, уже-tombstone (`old` —
не трогается), ссылки `controls`/LED/snapshot. Разобрано построчно и
сошлось на обеих сторонах (TS/Python) — паритетный тест
`#819 паритет с сервером на общей фикстуре` (`test/space-deletion.test.mjs`)
сравнивает оба кандидата на тех же данных. «Чем краснеет» — таблица ниже.

**AC3 (отмена).** `_confirmDanger` возвращает `false` → `_deleteSpace`
выходит до вычисления `currentDependencies`/записи
(`houseplan-editor-runtime.ts:8310`). Смок `cancelWritesNothing` зелёный
на HEAD. Разобрано чтением: до `accepted` нет побочных эффектов ни в одной
ветке.

**AC4 (конфликт).** Два независимых пути:
- клиентский — после подтверждения сверяется набор id блокирующих маркеров
  (`removeMarkers ? markerIds изменились : currentDependencies.count`),
  если поменялось — не пишет, показывает актуальный `N` и снимает `busy`
  (`houseplan-editor-runtime.ts:8319-8327`); смок
  `changedPlanUnderConfirmationDeletesNothing` зелёный, и я вручную поймал
  соответствующий мутант (`...ignores-a-moved-plan`) — без защитной строки
  тест падает ровно на этой проверке;
- серверный — несовпадение `expected_config_rev`/`expected_layout_rev`
  отклоняется `conflict` до вычисления кандидата
  (`websocket_api.py:2067-2070`), т.е. раньше, чем начнётся удаление
  маркеров: ничего не вычисляется и не коммитится. Доказано тестом
  `test_issue_819_space_delete_with_markers_conflict_deletes_nothing`
  (прочитан: ревизии, config, layout и `trail_recorder.book.data` не
  меняются). Пайтест не исполнял сам (см. «Гейты»/«Не проверял») — разбор
  чтением с явной пометкой.

**AC5 (прежнее поведение).** Без `remove_markers` — `_space_delete_target`
вызывает немутирующий путь (`source_config, source_layout = config,
layout` без копии, `removed_markers = []`) — побитово тот же `#244`
кандидат; закреплено тестом
`test_issue_819_space_delete_target_without_the_flag_is_the_244_candidate`.
Последнее пространство: `remove_markers` явно игнорируется условием `not
(len(spaces) == 1 and spaces[0]["id"] == space_id)` и на фронте —
`removeMarkers = withDevices && dependencies.count > 0 && !deletingLastSpace`;
тест `test_issue_819_last_space_ignores_the_flag` и фикстура-кейс 2
подтверждают: маркеры отвязываются (`space`/`room_id` снимаются), не
удаляются. Старые смоки (`danger_confirmation`, `orphan_space_references`,
`optional_space_model`, `post_write_adoption`) — прямое совпадение по
`smoke-select`, но сам не прогонял (см. «Не проверял»); доверяю прогону
автора плюс структурному чтению (ни один из затронутых путей не меняет
ветку без устройств/с последним пространством).

**AC6 (тексты и доки).** 3 новых ключа (`space.delete_with_devices`,
`space.delete_devices_body`, `space.delete_devices_hidden`) — все 4
каталога `src/i18n/settings/{de,en,fr,ru}.json`, построчно сверено.
USER-GUIDE.md/.ru.md §7 переписаны связно (скрытые, прокрутка+фокус каждый
раз, кнопка, одна запись, судьба устройства, отсутствие отмены после
записи, ссылка на §20/backup, конфликт); оба CHANGELOG — `User-Visible:
yes` коммит содержит оба файла. `ARCHITECTURE.md` — строка `space/delete`
обновлена с новым параметром и полем ответа.

## Защитные AC — таблица «чем краснеет»

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 прокрутка видна целиком | смок (прогнал сам, 31/31 HEAD / 10 красных dev) | мутант `space-delete-block-stays-out-of-view` — проверил сам (CAUGHT, 6 проверок) |
| AC1 фокус на предупреждении | смок (прогнал сам) | мутант `space-delete-block-leaves-focus-behind` — не исполнял сам, логика идентична соседнему (CAUGHT ожидаемо, чтение) |
| AC2 flag игнорируется → не удаляет | pytest (прочитан, не исполнен) | мутант `space-delete-ignores-remove-markers` (гард — тот же pytest) |
| AC2 tombstone обязателен | pytest + node-паритет (прочитаны) | мутант `space-delete-markers-leave-no-tombstone` |
| AC2 controls/LED/snapshot чистятся | pytest + node-паритет | мутанты `space-delete-markers-keep-control-links`, `space-delete-mirror-keeps-control-links` |
| AC2 файлы/следы чистятся после записи | pytest (прочитан) | мутант `space-delete-markers-keep-files-and-trails` |
| AC2 K считает скрытые | node-тест (прочитан) | мутант `space-delete-confirm-forgets-hidden-devices` |
| AC4 клиентский — набор маркеров сдвинулся | смок (прогнал сам) | мутант `space-delete-with-devices-ignores-a-moved-plan` — проверил сам (CAUGHT) |
| AC2 одна запись с флагом доходит до сервера | смок (прогнал сам) | мутант `space-delete-with-devices-drops-the-flag` |
| AC5 последнее пространство игнорирует флаг | pytest (прочитан) | мутант `space-delete-markers-on-the-last-space` |

Пустых третьих столбцов нет. Из 11 зарегистрированных мутантов 2
проверены мной исполнением (временный `git worktree`, патч → красный смок
→ откат, рабочая копия материала не трогалась), для остальных 9 —
структурный разбор чтением (патч действительно отключает проверяемый
инвариант, гард — правильный тест/смок) без независимого прогона; это
слабее, чем «исполнено», и честно помечено.

## Отступления от ТЗ — оценка

- **Онбординг без кнопки.** `renderSpaceForm` рендерит кнопку только когда
  `port.deleteSpace` задан; онбордингов порт его не задаёт (комментарий
  в `space-form.ts`: «Только редактор: онбординг создаёт, а не правит» —
  существовал до этого диффа, не новое решение автора). Проверил, что это
  не разрыв контракта по существу: `deleteBlockers`-путь в
  `houseplan-onboarding-runtime.ts` получил только хелпер прокрутки (AC1),
  без кнопки AC2 — согласуется с архитектурным инвариантом «онбординг
  создаёт пространства, а не редактирует существующие», поэтому состояние
  «блокировка с устройствами» в онбординге не наступает в продукте. Не
  нашёл в коде пути, которым онбординг-рантайм показывает диалог
  редактирования уже существующего пространства с устройствами — значит
  это не функциональный пробел, а честно описанный мёртвый код.
- **Уборка файлов/следов — на сервере, не отдельными клиентскими
  вызовами.** Прямо разрешено разделом «Принято предположительно» ТЗ.
- **`callout()` получил `focusable`.** Локальное расширение опции,
  не меняет публичный контракт компонента для существующих вызовов.
- **`removed_layout`/`removed_markers` в ответе.** Новое поле,
  back-compat (старая карточка игнорирует незнакомый ключ ответа).

## Находки

Находок в скоупе #819, которые требовали бы жёлтого вердикта, не нашёл.

**Medium, вне скоупа → #823.** `_space_delete_candidate`
(`custom_components/houseplan/websocket_api.py:1853`) чистит
`target_space_id` у лестниц при удалении пространства, но не чистит
`vacuum.map_routes` других (не удаляемых) маркеров, маршрутизирующих карту
робота в удаляемое пространство — после удаления такие маршруты ссылаются
на несуществующий `space_id`. Текст подтверждения (`confirm.delete_space_vac_routes`,
#162) обещает, что это будет снято, но на сервере (авторитетном месте
записи) снятия нет; есть оно только в непродуктовом TS-превью-кандидате
(`src/space-deletion.ts:165-172`, нигде не вызывается кроме тестов).
Дополнительно проверил сам: `validate_marker_vacuum_routes`
(`validation.py:999`) пропускает проверку маршрутов, если они не
изменились этой записью (`routes == old_routes`), а `ws_space_delete`
вообще не вызывает эту функцию — значит дырявая ссылка не только
создаётся, но и переживает последующие записи без диагностики. Баг не
новый и не создан этим диффом — `_space_delete_candidate` в материале
`origin/dev...HEAD` не менялась (сверено посимвольно), и автор сам отметил
находку как вне скоупа в комментарии к #819, но без issue («новые issue не
заводились»), что PROCESS.md §12 не признаёт закрытием. Завёл separately:
https://github.com/Matysh/houseplan-card/issues/823 (`bug`, `P2`, `S1-new`,
`vacuum`).

Остальные два пункта из «вне скоупа» в отчёте автора — рассмотрел и не
завёл отдельно:
- TS-кандидат не обнуляет `target_space_id` у лестниц (Python — обнуляет):
  `createSpaceDeletionCandidate` нигде не используется в продуктовом коде
  (только в `test/space-deletion.test.mjs`; грепнул весь репозиторий) — это
  паритетный мираж для тестов, расхождение не долетает до пользователя;
  сама фикстура честно документирует это («Stairs and robot map routes are
  left out on purpose»).
- «Онбординговый `_deleteSpace` в продукте недостижим» — см. «Отступления»
  выше, не функциональный дефект.

## Что проверено и корректно

- Атомарность записи (один `_commit_pair`, нет промежуточных await между
  вычислением кандидата и коммитом).
- Паритет TS/Python на общей фикстуре (дубль привязки, скрытые, виртуальный
  маркер, уже-tombstone, controls/LED/snapshot) — pytest и node-тест читают
  один и тот же JSON.
- AC4 — обе стороны защиты (клиентская сверка набора id, серверная
  ревизия) независимы и перекрывают разные гонки.
- AC5 — последнее пространство и «без устройств» бит-в-бит повторяют
  `#244`-поведение.
- i18n (4 каталога), USER-GUIDE (ru/en), CHANGELOG (ru/en) и
  ARCHITECTURE — согласованы между собой и с контрактом issue.
- Инвентарь гардов (267/41/119) и список `smoke-links.mjs` сверены
  построчно с добавленными записями.
- Трейлеры `Issue`/`User-Visible` на месте, changelog — в том же коммите,
  что и видимая правка.
- Независимо прогнал новый смок на HEAD (31/31) и на `origin/dev`
  (ровно 10 красных, совпадает с отчётом автора) во временном
  `git worktree`, не трогая материал ревью.
- Независимо проверил 2 из 11 мутантов реестра исполнением (CAUGHT).

## Чего не проверял

- `pytest tests_backend` сам не прогонял: в песочнице нет
  `homeassistant` (пин требует Python 3.14, в песочнице 3.12.3,
  установка полного HA-харнесса для разового ревью — не дешёвый гейт).
  Все новые тесты (`test_ha_websocket.py`) разобраны чтением, а защитная
  логика (AC2, AC4-сервер, AC5-последнее пространство) дополнительно
  перепроверена трассировкой кода вручную. Доверяю самоотчёту автора
  («1061 passed, 1 skipped»), но это самоотчёт, не независимый прогон.
- 9 из 11 мутантов реестра — не исполнял, только прочитал патч и
  убедился, что он действительно отключает проверяемый инвариант и что
  названный гард — правильный тест/смок.
- Полный `npm run gate:small`, `process-gate`, `golden:verify`,
  `invariants` — не прогонял; диффа в геометрии/рендере плана нет, доверяю
  зелёному Validate на этом SHA для typecheck/unit/build/bundle-policy.
- Ручное тестирование UI глазами (помимо смоков) не проводил.
- Не проверял производительность (не названа в AC).

## Вердикт

Зелёный. Найденный дефект (#823) — вне скоупа задачи и не создан этим
диффом; заведён отдельным issue со ссылкой на #819, продвижению #819 не
препятствует.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/819-space-delete-with-devices`, коммит `ccb2ad31bc3d` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `532b3ad473418bb49dd3ac5ef1f95ca5cf367d3a`
  ```
  git log --all --format='%H %T' | grep 532b3ad47341
  ```
- Тело issue: `bfea1e3ac13d4cfd584b4bd1dde99d260a3b6022a043f9127bcf85945bf40273`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:usage input_tokens=4551 output_tokens=46403 cache_creation_input_tokens=148071 cache_read_input_tokens=9554722 num_turns=91 -->
