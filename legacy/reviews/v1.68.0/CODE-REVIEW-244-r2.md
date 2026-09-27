# CODE-REVIEW-244-r2

- Issue: [#244](https://github.com/Matysh/houseplan-card/issues/244)
- Этап: code (PROCESS.md §2.7)
- Заход: r2 · блокирующих циклов израсходовано 1 из 4
- Кандидат (HEAD): `a9466da649c5a24ad84cc79b0e6389b724dc8087`
- SHA предыдущего раунда (r1, красный): `a09338f` (`build: refresh issue 244 bundle fingerprints`)
- Дельта разбора: `git diff a09338f..HEAD`

## Скоуп раунда

r1 (2026-08-22T19:55:17Z, `docs/reviews/CODE-REVIEW-244-r1.md`) дал красный
вердикт на кандидате `a09338f`: High: 2, Medium: 0.

- **H1** — именованный в AC смок `demo/smoke_orphan_space_references.mjs`
  красный из-за дефекта тестовой фикстуры (Optimize→Undo и delete-blocker
  сценарии делили один и тот же маркер).
- **H2** — регрессия контракта #113: новый безусловный preflight в
  `_deleteSpace()`/`_space_delete_candidate()` блокировал удаление
  единственного оставшегося пространства с хотя бы одним активным маркером,
  оставляя пользователя без пути в состояние «Пусто».

Между r1 и r2 автор:

1. исправил фикстуру H1 (`389baca`);
2. вынес H2 на арбитраж владельца, получил явное решение (комментарий
   `2026-08-22T21:07:34Z`: узкое исключение для единственного оставшегося
   пространства, снимаются только `space`/`room_id`, binding/icon/actions
   сохраняются, при 2+ пространствах блокировка остаётся);
3. реализовал решение (`74f03bf` — продуктовый код, тесты, ТЗ, оба
   changelog, USER-GUIDE.md/.ru.md, CONFIG-COMPATIBILITY.md, TESTING.md;
   `a9466da` — принят docs-скриншот-фингерпринт).

Дельта не ребейзилась на ушедший вперёд `dev`, не меняет контракт поведения
за пределами явно арбитрированного исключения и не задевает новую
подсистему — она локальна к сценарию удаления пространства (frontend
`_deleteSpace`/`space-deletion.ts`, backend `_space_delete_candidate`/
`ws_space_delete`, их тесты и синхронизированная документация). Поэтому
разбор r2 ограничен этой дельтой; остальное наследуется из r1 без повторной
проверки (раздел ниже).

## Как проверялось

Прочитан полный `git diff a09338f..HEAD` (19 файлов, +587/-62) построчно:
`src/houseplan-card.ts` (`_deleteSpace`), `src/space-deletion.ts`
(`createSpaceDeletionCandidate`/`collectSpaceMarkerDependencies`),
`custom_components/houseplan/websocket_api.py`
(`_space_delete_candidate`/`ws_space_delete`), оба новых теста
(`test/space-deletion.test.mjs`, `tests_backend/test_ha_websocket.py`), обе
правки смоков, обновления `docs/specs/244-orphan-space-references.md` (§2,
§3, §8, §10, таблица AC9/AC10) и синхронные правки
`docs/CHANGELOG.md`/`.ru.md`, `docs/USER-GUIDE.md`/`.ru.md`,
`docs/CONFIG-COMPATIBILITY.md`, `docs/TESTING.md`.

Frontend (`space-deletion.ts`) и backend (`websocket_api.py`) реализации
проверены на структурную симметрию — они дублируют одну и ту же логику
(`deletingLastSpace` / `deleting_last_space`, три источника
`referencesDeletedSpace`: `marker.space`, `marker.room_id` через
`roomIds`, собственная позиция маркера в `layout`) и совпадают построчно
по смыслу.

### Гейты — прогнаны

| Гейт | Результат |
|---|---|
| `npx tsc --noEmit` | PASS, без вывода |
| `npm test` | 1113/1113 PASS (было 1112 на кандидате r1 — дельта добавила 1 тест в `test/space-deletion.test.mjs`) |
| `npm run build` + сверка трёх копий бандла | PASS; `dist/houseplan-card.js`, `demo/srv/assets/houseplan-card.js`, `custom_components/houseplan/frontend/houseplan-card.js` — идентичный SHA-256 `02f6585f7df6fd70005e78ead84f50d99eb843f8fae64119fd4e98c0232e2f9e`, совпадает с заявленным в хендоффе |
| `node scripts/check-docs.mjs` | PASS: «Documentation checks passed (7 files, 10 external links)» — фингерпринт скриншотов из `a9466da` принят |
| `python -m pytest tests_backend -q` | В песочнице ревью изначально не было установлено `pytest-homeassistant-custom-component`/`homeassistant` (в отличие от заявления «зависимости уже установлены workflow»); установил тем же набором пакетов, что и CI-workflow (`pip install pytest voluptuous pytest-homeassistant-custom-component home-assistant-frontend`), после чего прогнал полный набор: **352 passed, 1 error**. Ошибка — `test_ha_upload.py::test_upload_ok`, `AssertionError` на `threading._DummyThread` при остановке hass; не связана с диффом (дельта `websocket_api.py` его не касается), и в r1 уже была независимо воспроизведена на чистом `origin/dev`. Два новых теста issue 244 (`test_issue_244_last_occupied_space_candidate_detaches_all_affected_markers`, `test_issue_244_last_occupied_space_delete_preserves_marker_records`) — в числе прошедших |
| `git diff --check a09338f..HEAD` | чисто, без вывода |

### Смоки — прогнаны выборочно

`node scripts/smoke-select.mjs --base a09338f --head HEAD`: 2 символа на
изменённых строках, матрица 169 смоков. Инструмент не выдал ни «прямого
совпадения», ни «зарегистрированной связи» — только «слабую связь» (общее
имя `_spaceDialog`, 23 смока) и явную «НЕОПРЕДЕЛЁННОСТЬ». Слабая связь сама
по себе не обязывает прогонять все 23 — но два смока из этого списка прямо
названы в таблице AC10 ТЗ как источник доказательства
(`smoke_orphan_space_references`, `smoke_optional_space_model`), поэтому
они прогнаны целиком, а не выборочно по имени:

- `node demo/smoke_orphan_space_references.mjs` → все 10 ассертов `true`,
  включая `deleteExplainsBlockerWithoutConfirmOrWrite: true` — это прямое
  закрытие H1 (в r1 этот же ассерт был `false`).
- `node demo/smoke_optional_space_model.mjs` → все 11 ассертов `true`,
  включая новые `deleteLastUsesAuthoritativeEndpoint: true` и
  `deleteLastPreservesMarkersWithoutPlacement: true` — прямое закрытие H2
  (в r1 5 из 9 ассертов этого смока были красными на том же кандидате).

Остальные 21 смок из «слабой связи» не прогонялись: дельта не трогает их
собственные сценарии (цветовые пикеры, шрифты, слои, сохранённые планы и
т.д.), связь с `_spaceDialog` объясняется тем, что это широкое общее поле
диалога, через которое проходит любой код редактора пространства — не
специфика этой правки. `smoke_optimize_geometry_preflight` и
`smoke_fixed_floor`, упомянутые в хендоффе автора, дельтой r2 не задеты
(они закрывают AC7/AC11, не AC9/AC10) и не перепрогонялись — решение по
объёму, не пропуск.

### Гейты — не прогнаны (и почему)

- `npm run golden:verify` — дельта не меняет рендер, геометрию, стили или
  слои; она меняет только данные (`marker.space`/`room_id`, `layout`) и
  порядок веток в preflight/backend-транзакции. Визуальный результат
  строки AC не заявляет.
- Mutation-тестирование — не названо в AC9/AC10/AC12 для этой правки;
  неизменность входа уже утверждается напрямую в обоих новых unit-тестах
  (`config.markers[0].space === 'only'`, `layout.direct.s === 'only'`,
  `config["markers"][0]["space"] == "only"`, `layout["direct"]["s"] == "only"`
  после вызова). Это предрелизный гейт, не гейт ревью.
- performance-профили — путь не является горячим (однократная операция по
  явному действию пользователя), в AC не назван.
- Полный browser smoke (167 сценариев) — дельта локальна к одному
  сценарию (`_deleteSpace`), `smoke-select` не выдал широкого совпадения;
  полный прогон — предрелизный гейт (PROCESS.md §8).

## Находки

Нет. H1 и H2 из r1 закрыты; новых High/Medium в дельте не найдено.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **H1** — `demo/smoke_orphan_space_references.mjs` красный (`deleteExplainsBlockerWithoutConfirmOrWrite: false`) из-за общего маркера между Optimize→Undo и delete-blocker сценариями | Коммит `389baca`: в фикстуру добавлено отдельное пространство `other` (делает `home` не последним) и отдельный маркер `home-blocker`, который единственный реально блокирует удаление `home`; маркер `orphan` из Optimize→Undo сценария больше не пересекается с ним | `git diff a09338f..HEAD -- demo/smoke_orphan_space_references.mjs`; локальный прогон смока — `deleteExplainsBlockerWithoutConfirmOrWrite: true`, остальные 9 ассертов тоже `true` |
| **H2** — безусловный preflight блокирует удаление единственного оставшегося занятого пространства, ломая empty-state контракт #113 | Владелец арбитрировал узкое исключение (комментарий `2026-08-22T21:07:34Z`); реализовано в `74f03bf`: `deletingLastSpace`/`deleting_last_space` в `src/houseplan-card.ts`, `src/space-deletion.ts`, `custom_components/houseplan/websocket_api.py` — при единственном пространстве preflight и backend-guard больше не блокируют удаление по dependencies, атомарно снимают `space`/`room_id` у затронутых active/removed маркеров, остальные поля не трогают; ТЗ §3/§10/AC9/AC10, оба changelog, `USER-GUIDE.md/.ru.md`, `CONFIG-COMPATIBILITY.md`, `TESTING.md` синхронно обновлены в том же коммите (`User-Visible: yes`) | `git diff a09338f..HEAD -- src/houseplan-card.ts src/space-deletion.ts custom_components/houseplan/websocket_api.py docs/specs/244-orphan-space-references.md`; новые тесты `test/space-deletion.test.mjs` («deleting the last occupied space detaches placement but preserves markers») и `tests_backend/test_ha_websocket.py` (`test_issue_244_last_occupied_space_candidate_detaches_all_affected_markers`, `test_issue_244_last_occupied_space_delete_preserves_marker_records`) — все PASS; смок `smoke_optional_space_model` — `deleteLastUsesAuthoritativeEndpoint: true`, `deleteLastPreservesMarkersWithoutPlacement: true` |

## Унаследовано из r1 (без повторной проверки)

Документ: `docs/reviews/CODE-REVIEW-244-r1.md`, SHA кандидата `a09338f`.

- Диагноз §3 ТЗ и его соответствие коду (`resolveExplicitMarkerPlacement`,
  приоритет `marker.space` для virtual-маркера, фильтр рендера View/Static,
  `_deleteSpace()` до правки, `build_space_merge()`, `resolveInitialSpace()`).
- Optimize-репаир ссылок (signature-remap, effective HA Area, safe-detach
  для нерешённых, `nestedRefsUnresolved`, `vacuum.segment_map`, room-label
  positions) — AC1–AC8, AC12, AC13, AC14 из таблицы ТЗ; дельта r2 их не
  трогает.
- Import одного пространства чинит существующие target-orphan ссылки по
  `id_map` (AC8) — не задет.
- Валидация `default_floor` в редакторе карточки, RU/EN inline-ошибка,
  безопасный fallback на первое пространство (AC11) — не задета.
- Гейты `tsc --noEmit`, `npm run build`+сверка бандла,
  `node scripts/check-docs.mjs`, backend pytest (кроме двух новых тестов),
  `git diff --check` — уже были зелёными на `a09338f` для той части
  дифф-объёма, которую r2 не менял; в r2 они перепрогнаны заново целиком
  (см. таблицу гейтов выше) как более дешёвый путь, чем вычленять
  неизменную часть, но результат по неизменным файлам совпадает с r1.
- Touch/kiosk паритет View/Static-рендера (закрыт ещё на этапе spec,
  SPEC-REVIEW-244-r2) — реализация r1/r2 не меняет рендер-путь, вывод
  наследуется без повторной проверки.

## Что проверено и корректно

- Frontend (`space-deletion.ts`) и backend (`websocket_api.py`) реализации
  исключения для последнего пространства структурно симметричны и
  одинаково определяют «затронутый» маркер: прямая ссылка `space`, `room_id`
  комнаты удаляемого пространства, либо собственная позиция в `layout` с
  `s == spaceId`.
- Затронутым маркерам снимаются ровно `space` и `room_id`; `binding`,
  `icon`, `actions`, `description` и прочие поля не трогаются — проверено
  и unit-тестами (icon/actions сохранены), и backend-тестом полного
  жизненного цикla через реальный `hass_ws_client`.
- Незатронутые маркеры с уже орфанной ссылкой (`space: 'legacy'` в тесте) не
  переписываются — соответствует AC12 («уже валидные... не входит» — здесь
  наоборот, уже-невалидная чужая ссылка тоже не тронута, это не откат
  выполненного AC12, а сохранение чужого, не принадлежащего удаляемому
  пространству, состояния).
- При 2+ пространствах старое поведение блокировки не изменилось: тест
  `test_issue_244_space_delete_dependency_and_tombstone_candidate` (не
  тронут диффом) и первая половина `smoke_orphan_space_references`
  (`deleteExplainsBlockerWithoutConfirmOrWrite`) подтверждают, что
  исключение сработало только для `deleting_last_space`.
- UI-путь: `_deleteSpace()` при `deletingLastSpace` пропускает диалог
  блокеров и идёт к обычному `confirm()`, при неудаче (`conflict`/
  `space_in_use`) пересчитывает `stillLastSpace` по свежим данным — гонка,
  где параллельно появилось второе пространство или новый маркер, снова
  корректно показывает blockers вместо тихого отказа.
- Backend-транзакция остаётся под `write_lock`, ревалидирует обе revision
  и пишет config/layout атомарно — новый код встроен в существующий
  guard, не ослабляет его (проверено чтением, дополнительно подтверждено
  прогоном `test_issue_244_space_delete_is_authoritative_and_revision_guarded`,
  не тронутого диффом, и новым
  `test_issue_244_last_occupied_space_delete_preserves_marker_records`).
- Документация (ТЗ §2/§3/§8/§10/таблица AC, оба CHANGELOG, оба USER-GUIDE,
  CONFIG-COMPATIBILITY.md, TESTING.md) синхронно и без противоречий
  описывает именно реализованное исключение — совпадает построчно с
  логикой кода, а не только с решением владельца в общих словах.
- Трейлеры: `74f03bf` (`User-Visible: yes`) содержит правки обоих
  changelog в том же коммите; `389baca` и `a9466da` — `User-Visible: no`,
  соответствует их содержанию (тестовая фикстура и docs-фингерпринт).

## Что не проверялось (и почему)

- Полный browser smoke (167 сценариев) — не запускался; выборка через
  `smoke-select.mjs` не дала оснований для полного прогона, дельта
  локальна к одному сценарию. Это предрелизный гейт (PROCESS.md §8).
- `npm run golden:verify` — не запускался, дельта не меняет визуальный
  результат (см. таблицу гейтов).
- Mutation-тестирование — не запускалось, не в AC для этой правки,
  неизменность входа уже прямо утверждается в новых unit/backend тестах.
- Performance-профили — не запускались, путь не горячий и не назван в AC.
- Ручное тестирование в браузере (открыть карточку, вживую удалить
  единственное пространство) — не проводилось; вместо этого прогнаны
  browser-смоки headless (`smoke_orphan_space_references`,
  `smoke_optional_space_model`), которые управляют тем же
  `HouseplanCard`-элементом через реальный DOM/Lit-рендер в Puppeteer, а
  не мокают его — это и есть браузерное доказательство для AC9/AC10 по
  их собственному способу доказательства из таблицы ТЗ.
- Полный обзор кода Optimize/import/`default_floor` (§8, §9, §11 ТЗ) —
  не перечитывался заново; наследуется из r1 (см. раздел выше), дельта
  r2 эти файлы не трогает.
