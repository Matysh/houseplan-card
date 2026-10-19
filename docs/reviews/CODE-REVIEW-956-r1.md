# CODE-REVIEW-956-r1

Issue: #956 · Этап: code · Трек: ask · Заход: r1 · блокирующих циклов использовано 0/4
Материал: `git log --oneline origin/dev..HEAD` / `git diff origin/dev...HEAD`
SHA материала: `100a33f686b9d0a45bb628097fac3d5ad46612a3` (рабочая копия на нём, `git fetch/checkout` не выполнялись)
Validate на этом SHA: success (https://github.com/Matysh/houseplan-card/actions/runs/39223165596)
Route: `fix`
Побочные находки: `mode=issues` (доверенный снимок prepare) — побочных Medium/High вне скоупа не найдено, новые issue не заводились.

## Скоуп

Общий слой toast-уведомлений карточки: `_showToast`/`ToastPresentation` переносит
единственный DOM-узел сообщения в footer верхнего активного `hp-dialog` (HA или
native fallback) либо в корневой плейсхолдер карточки, вместо старого
`z-index`-а, который не может перекрыть настоящий browser top-layer модала.
Изменены: `src/toast-presentation.ts` (новый), `src/styles/toast.styles.ts`
(новый), `src/hp-dialog.ts`, `src/houseplan-card.ts`, `src/styles/base.styles.ts`;
тесты `test/toast-presentation.test.mjs`, `test/toast-paint-oracle.test.mjs`,
`demo/smoke_modal_toast_956.mjs` + `demo/helpers/toast-paint-956.mjs`; реестр
мутаций, smoke-links, data-hp-contract, оба CHANGELOG, ARCHITECTURE/DEVELOPMENT/
STATUS, release-ledger `v1.81.0/956.json`.

Коммитов в материале 5: `a76f3dc2c` (fix, User-Visible: yes, оба changelog в том
же коммите), `4e9b3c2d9` (test), `348db26ef` (docs-only, трейлеров нет — класс C,
трейлеры не нужны), `66688d4a7` (build, Issue/User-Visible: no), `100a33f68`
(docs, Issue/User-Visible: no, удаляет временный `docs/testing-notes/956-modal-toast.md`
— доказательства перенесены в тело issue, дублей/висячих ссылок не осталось,
проверено `grep -rn 956-modal-toast`).

## Риск по изменённым участкам (#707)

- **perf: `src/toast-presentation.ts:62` — токен `requestAnimationFrame`.**
  Прочитано чтением и проверено исполнением (`--lifecycle` смок ниже). RAF
  планируется только из `show()`, которую вызывает исключительно
  `_showToast()` (явный показ сообщения пользователю), не из планового
  рендера/pointermove. Каждый `show()` сначала `cancelAnimationFrame` старого
  кадра; `clear()`/`disconnect()` тоже отменяют. `refresh()` (вызывается из
  `updated()` карточки на КАЖДОМ цикле рендера) не планирует кадр вообще — это
  чистый `_route()`, который при отсутствии активного сообщения (`!notice`)
  возвращается на первой строке без обращения к DOM. Значит компонент не
  добавляет работу в обычный/перетаскиваемый рендер, только в ограниченную
  by-user-action серию из одного кадра на сообщение — ровно то, что требует
  риск-класс perf в ТЗ (§9 «Performance»). AC1/AC4 покрывают это и сценарием
  (единственное объявление на новое и на повторное одинаковое сообщение), и
  исполнены мной лично (см. «Гейты»).

## Как проверялось

### Гейты

| Гейт | Результат | Примечание |
|---|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build` + сверка bundle | не перегонял | Validate зелёный на этом же SHA (см. ссылку выше); §343 разрешает не повторять |
| `npm run build` (локально, для смоков) | PASS, 29.7s | нужен был только чтобы поднять `dist/` для demo-смоков; tsc внутри прошёл без ошибок |
| `node scripts/bundle-sync.mjs` | выполнено | синхронизация `dist/` → `demo/srv/assets` отсутствовала в рабочей копии, без неё браузерные смоки падали на `Failed to fetch dynamically imported module`; это генерируемый вывод, предмет ревью не менялся |
| `node demo/smoke_modal_toast_956.mjs` (default, room/390/dark/ha) | PASS, вкл. `failureTextIsPainted: true` (ink 177/177) | лично прогнал |
| `node demo/smoke_modal_toast_956.mjs --matrix` | PASS, 16/16, 96 assertions | лично прогнал, числа совпали с заявкой автора |
| `node demo/smoke_modal_toast_956.mjs --lifecycle` | PASS (genuine HA) | лично прогнал: `childOwnsOnlyNotice`, `repeatedTextAnnouncesAsNew`, `expiryNotRestartedByOwner`, `detachClearsNotice` и т.д. — все true |
| `node demo/smoke_modal_toast_956.mjs --native --lifecycle` | PASS | лично прогнал, тот же набор на native fallback |
| `node --test test/toast-presentation.test.mjs test/toast-paint-oracle.test.mjs` | PASS, 4/4 | лично прогнал после `tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs` |
| `node --test test/data-hp-contract.test.mjs test/hp-test-facade.test.mjs` | PASS, 10/10 | лично прогнал (новый `toast-portal` hook) |
| Прямое совпадение `smoke-select` (5): `smoke_plan_drawing_repairs`, `smoke_plan_snap_overlay`, `smoke_room_autoclose`, `smoke_unified_wall_tool`, `smoke_wall_union_isolation` | PASS, все 5 | **автор их не прогонял** (аргументировал омонимией `_frame`/`_toast` с геометрическими полями карточки), см. находку Low ниже; я прочитал код и лично прогнал — пробел закрыт, регрессий нет |
| Выборочные «общей границы» смоки, заявленные автором: `smoke_dialog_modal_recovery`, `smoke_config_writer`, `smoke_marker_write_rollback`, `smoke_readonly_cold_start` | PASS, все 4 | лично перепрогнал как выборочную проверку заявленных автором 10 |
| `node scripts/mutation-gate.mjs --check` | PASS, definitions=1699, execution=0, browser guards 420/200 (warn, не fail) | лично прогнал, совпадает с заявкой автора; мутанты НЕ исполнялись (ни мной, ни автором вне ночи) |
| `node scripts/process-gate.mjs --range origin/dev..HEAD --issues --report` | PASS, 0 warnings | лично прогнал |
| `golden:verify` | не прогонял | `classifyRisk` даёт `visual.render=false`, метки `ci:golden` нет, правка не трогает путь отрисовки плана — по §8/§5.1 не требуется |
| `pytest tests_backend` | не прогонял | Python не менялся |
| `npm run invariants` | не прогонял | геометрия модели не менялась |

### Чего не проверял и почему

- Полный `npm test`/`tsc --noEmit`/`npm run build` с тройной сверкой бандла —
  принял зелёный Validate на этом SHA (ссылка выше); вместо этого лично
  прогнал `npm run build` (нужно было для смоков) и целевые `node --test`.
- Остальные 6 из 10 заявленных автором «common-boundary» смоков
  (`smoke_dialog_help_clipping`, `smoke_color_picker_consumers`,
  `smoke_empty_backup_import`, `smoke_kiosk_scale_no_editor`,
  `smoke_sections_resize`, `smoke_styling_hooks`) — `smoke_styling_hooks`
  прогнал лично (понадобился для восстановления `demo/srv/assets`), остальные
  5 не перегонял: `weak-link`-уровень по `smoke-select`, не правят toast-путь
  напрямую, доверился заявленному PASS.
- Ручная проверка screen-reader/реальным GPU/физическим устройством — вне
  объёма ревью (headless/pixel-oracle автоматизация — весь объём, который
  требует ТЗ и который можно верифицировать в CI-окружении).
- Исполнение зарегистрированных мутантов `modal-toast-below-top-layer-956` и
  `modal-toast-reannounces-on-route-956` — запрещено вне ночного workflow;
  проверил статически, что оба `find`-паттерна встречаются в
  `src/toast-presentation.ts` ровно один раз (`node -e` подсчёт совпадений),
  то есть `--check` не солгал бы о попадании патча не туда.

## Находки

### Low — 5 smoke с «прямым совпадением» не были прогнаны автором (закрыто при ревью)

`node scripts/smoke-select.mjs --base origin/dev --head HEAD` относит
`smoke_plan_drawing_repairs.mjs`, `smoke_plan_snap_overlay.mjs`,
`smoke_room_autoclose.mjs`, `smoke_unified_wall_tool.mjs`,
`smoke_wall_union_isolation.mjs` к «прямому совпадению» (символы `_frame`,
`_toast`), что по `docs/TESTING.md`/§8 означает «прогон», а не «на усмотрение
ревьюера». Автор в итоговом комментарии объяснил это омонимией:
`card._frame` в этих смоках — геометрический RAF-токен самой карточки
(`src/houseplan-card.ts`), не приватное поле `ToastPresentation._frame`; а
`card._toast` читается/обнуляется как существовавший раньше публичный виджет
состояния («последнее показанное сообщение»), который `_showToast` по-прежнему
корректно пишет — но аргумент не заменяет прогон. Я прочитал все 5 файлов:
записи `card._toast = ''` происходят только в `reset()`-хелперах ДО первого
вызова `_showToast` в сценарии (поле ещё не связано ни с каким DOM-узлом
`ToastPresentation`), а чтения — сравнение поля с ожидаемой строкой, не запрос
DOM. Лично прогнал все 5 — все PASS, никаких побочных эффектов от того, что
`_toast` стал небезопасным для прямой записи после показа (чем раньше управлял
рендер, а теперь — presentation-слой), не обнаружено. Не блокирует: доказательство
теперь есть, дефекта нет. Снимаю находку с записью, цикл не открывает.

## Что проверено и корректно

- **AC1** (видимый paint над genuine HA/native модалом): лично прогнанный
  `smoke_modal_toast_956.mjs` (default + `--native`) даёт независимый
  ink-oracle `painted: true`, `ratio: 1`; до фикса (по комментарию автора,
  воспроизводимо по неизменному `_route`) painted было `false` (3/191 и
  18/191 < порога 92%). Оракул действительно независим: сравнивает реально
  нарисованные пиксели с popover-референсом тех же computed-стилей, не DOM/
  isVisible (`demo/helpers/toast-paint-956.mjs`).
- **AC2** (4 формы × 2 viewport × 2 темы, draft/accepted/retry/геометрия):
  матрица 16/16 лично перепрогнана, все под-проверки true, включая
  `geometryUnchanged` (header/footer/outer bbox до/после побайтово равны).
- **AC3** (стек parent→confirm, detach, timer не продлевается):
  `--lifecycle` лично прогнан на HA и native: `childOwnsOnlyNotice`,
  `rootReceivesSameNotice`, `oldTimerCannotClearReplacement`,
  `expiryNotRestartedByOwner` (возраст второго сообщения 3400–4400мс — то есть
  таймер отсчитывается от ВТОРОГО `_showToast`, а не продлён первым),
  `detachClearsNotice` — все true. Код: `setToastOwner` убирает владельца из
  стека по ссылочному равенству на `_requestClose`/`disconnectedCallback`,
  `_route` берёт `owners[owners.length-1]` (последний АКТИВНЫЙ, т.е. самый
  «верхний» по порядку открытия/реактивации) — согласуется с существующей
  `focusSessions`-моделью в том же файле (переиспользование паттерна, не
  новая модель).
- **AC4** (одно объявление, не дублируется при рероутинге): юнит-тест
  `test/toast-presentation.test.mjs` проверяет точные атрибуты
  (`role`/`aria-live` снимаются при каждом перемещении уже показанного узла,
  восстанавливаются только при НОВОМ `show()`); браузерный `--lifecycle`
  подтверждает `oneAnnouncementForNewMessage`, `routeDoesNotAnnounce`,
  `repeatedTextAnnouncesAsNew` (одинаковый текст объявляется заново как
  новое) и `actualAXAlert` по настоящему CDP accessibility tree (не просто
  DOM `role="alert"`).
- **AC5** (обычный toast, две карточки, detach): юнит-тест покрывает два
  независимых `ShadowRoot`-скоупа без шанса кросс-карточной маршрутизации
  (`toastRootOf` поднимается именно до `houseplan-card`, не до `document`);
  `disconnectedCallback` карточки вызывает `_toastPresentation.disconnect()`
  (снимает таймер/кадр/DOM-узел) — проверено чтением и `detachClearsNotice`
  исполнением.
- **AC6** (нет новой схемы/прав/транспорта, не 4 копии фикса): один класс
  `ToastPresentation` + один `ToastOwner`-контракт используются всеми 4
  формами без дублирования; `scripts/mutation-registry.mjs`/`smoke-links.mjs`
  обновлены точечно под новые файлы; bundle-бюджет превышен на 213 Б с явным
  одобрением владельца в чате (зафиксировано issue-комментарием), применена
  только эта база, остальные лимиты/полосы не менялись — проверено диффом
  `scripts/monolith-baseline.json` (только `bundleBytes`).
- **CSS-каскад**: `toastStyles` вынесен в отдельный модуль и используется и
  `baseStyles`, и `hp-dialog`'s `static styles` — два независимых shadow-root
  дерева, конфликта специфичности нет; перемещение `.toast`-правила с конца
  `baseStyles` в начало не меняет порядок относительно `planStyles`/
  `devicesStyles`/`chromeStyles`/`dialogsStyles` (они все идут после
  `baseStyles` целиком), а внутри `baseStyles` других селекторов `.toast`/
  `.toast-portal` нет — golden/каскадный контракт не нарушен. Golden не
  запрашивался — соответствует `visual.render=false`.
- **data-hp-contract**: новый `toast-portal` (audience: `test`, elements:
  `div`) описывает только публичный корневой плейсхолдер
  (`<div data-hp="toast-portal">`); CSS-класс `.toast-portal` на footer
  `hp-dialog` — внутренний хук стилизации вне `data-hp`-контракта и вне
  `STYLING-HOOKS.md` (card-mod контракт не расширяется тестовым хуком) —
  согласовано с `test/data-hp-contract.test.mjs`, прогнанным лично.
- **Release-артефакты**: классификация `stable-fix` перепроверена чтением —
  `.toast { z-index: 120 }` и `_showToast`, рендерящий `.toast` в корне карточки,
  уже существуют в теге `v1.81.0` (`git show v1.81.0:src/styles/base.styles.ts`),
  то есть дефект не введён формами #944/#946 — обоснование в
  `docs/release-ledger/v1.81.0/956.json` корректно; `introducedBy` не требуется
  (не line-fix). Оба CHANGELOG и `fix`-коммит в одном коммите с
  `User-Visible: yes`. STATUS.md числа тестов (`4885`/`393`) — из генератора,
  второй копии числа в репозитории нет.
- **Трейлеры**: все не-docs коммиты несут `Issue:`/`User-Visible`; docs-only
  `348db26ef` трейлеров не несёт — верно по правилу (класс C).

## Унаследовано из r0

Раунд первый, раздела «Унаследовано» и «Закрытие r0» не требуется.

## Вердикт

Зелёный. High: 0, Medium: 0 (ни в скоупе, ни вне его). Один Low снят ревьюером
(см. «Находки») без влияния на вердикт. Защитные AC1/AC3/AC4 имеют честную
таблицу «чем краснеет» в комментариях автора (зарегистрированный свидетель +
«не исполнялся», либо обычный before/after negative case) — переносить её
копией сюда избыточно, проверена по существу выше.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/956-modal-toast`, коммит `100a33f686b9` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `e1bab09ea025bc1d14e8299089d1f8c588201c91`
  ```
  git log --all --format='%H %T' | grep e1bab09ea025
  ```
- Тело issue: `ee6c34acc7eda9c02feefde123fbe4e1c0c9b47f10dc17fb092604a3474ee47d`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ4NTEsIm91dHB1dF90b2tlbnMiOjEzLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0OTE2fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxNTQsIm91dHB1dF90b2tlbnMiOjUwNDc3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE1MjI2MCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjkyMDk4MjMsImNvc3RVc2RFc3RpbWF0ZSI6Mi45NTYwODI2fV0sInR1cm5zIjo4NywiZHVyYXRpb25NcyI6ODc5NjMzLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6Mi45NjA5OTg2LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=5005 output_tokens=50490 cache_creation_input_tokens=152260 cache_read_input_tokens=9209823 num_turns=87 -->
