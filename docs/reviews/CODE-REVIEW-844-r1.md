# CODE-REVIEW-844-r1

Issue: #844 · этап code · заход r1 · блокирующих циклов 0/4 · трек ask
Материал: ветка `issue/844-view-edit-permissions`, коммит
`114ebd2f81b239c42da58bdce8cb3a06dfe17998` (рабочая копия на нём, `git diff origin/dev...HEAD`).
Предшествующий этап: SPEC-REVIEW-844-r1, GREEN (ТЗ редакция 3, решения владельца 1А/2Б).

## Скоуп

ТЗ (редакция 3 от 14.10.2026, тело issue) закрывает защитный UX-дефект:
информационная карточка устройства открывала редактор устройства и инициировала
`config/set`/снятие флага «новое» без проверки права записи и вне зависимости от
киоска; значок HA-зоны в подписи комнаты вёл на `/config/areas/area/<id>`
без проверки `is_admin`. Диапазон коммитов:

- `b9134437` fix(view): enforce device editor and HA Area permission boundaries
- `5889c291` chore(monolith): record measured #844 cold View permission gate growth
- `078c8bfd` test(view): leave kiosk before asserting the entity editor preview
- `27555a19` test(view): register the AC7 inverse more-info permission witness
- `114ebd2f` test(golden): accept the two owner-approved kiosk Area-link removals

Изменены: `src/houseplan-card.ts`, `src/houseplan-editor-runtime.ts`, новый
`src/device-editor-access.ts`, `demo/smoke_view_edit_permissions.mjs` (новый),
`demo/smoke_entity_parent_dedup.mjs`, `test/device-editor-access.test.mjs`,
`test/device-editor-permissions-runtime.test.mjs`, `tests_backend/test_ha_websocket.py`,
`scripts/mutation-registry.mjs`, `scripts/bundle-budget.mjs`, `scripts/smoke-links.mjs`,
golden `baselines-index.json` + 2 PNG, каноны/гайды/CHANGELOG/release-ledger.
Backend Python (`websocket_api.py`) не менялся — соответствует ТЗ («сервер не меняется»).

**Риск по изменённым участкам (#707).** Трек ask — сверка «каждый класс покрыт AC»:
класс `devices` помечен по двум токенам `is_admin`:

- `src/houseplan-card.ts:7064` (`_clickRoom`) — покрыт AC5 (навигация к зоне только
  при `is_admin && !kiosk`, не в Plan);
- `src/houseplan-card.ts:12256` (рендер подписи комнаты, `roomAreaAffordance`) —
  покрыт AC5 (видимость/интерактивность значка).

Оба — один и тот же предикат `roomAreaAffordance` из нового модуля, используемый
и в клике, и в рендере; расхождения между проверкой клика и условием рендера нет.
Класс покрыт полностью.

## Как проверялось

Дешёвые гейты подтверждены зелёным Validate на точном SHA материала (run
[38531768222](https://github.com/Matysh/houseplan-card/actions/runs/38531768222)) —
не повторял `npx tsc --noEmit` / `npm test` / `npm run build`+bundle-policy по
правилам раунда. Дополнительно локально (не обязательно, но дёшево и быстро):

| Гейт | Команда | Результат |
|---|---|---|
| Build + typecheck | `npm run build` | OK, 25 с |
| Unit-тесты модуля и рантайма | `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test test/device-editor-access.test.mjs test/device-editor-permissions-runtime.test.mjs` | 3/3 PASS |
| lint:unused | `npm run lint:unused` | OK — delegates 153, portMembers 361, hostRefs 5244, portPrivates 106, bundleBytes 2840500 — совпадает с заявленным в хэндоффе |
| Бюджет бандла | `npm run bundle:budget` | OK, initial View 309653 B ровно на новом потолке `309653+2000`, budget 320000 не нарушен |
| Новый смок (диффом выбран `smoke-select`) | `node demo/smoke_view_edit_permissions.mjs` | **все 99 проверок `true`, OK** — роли×киоск×touch, поздний импорт (writer/kiosk/disconnect/newer), тёплое восстановление, матрица видимости/навигации/drag значка зоны, lifecycle киоска-writer |
| Связанные по `smoke-links.mjs`/диффу | `node demo/smoke_room_link.mjs`, `node demo/smoke_entity_parent_dedup.mjs` | OK (оба) |
| AC7 — разрешённые действия не тронуты | `smoke_card_controls`, `smoke_tap_ctx`, `smoke_kiosk`, `smoke_kiosk_scale_no_editor`, `smoke_room_fit` | все OK |
| Мутант-реестр (без исполнения — ночной гейт) | `node scripts/mutation-gate.mjs --check` | GREEN, 313/200 (WARN ожидаем, зафиксирован в `docs/testing-notes/mutation-browser-guards.md`) |
| Golden-attestation | `gh api .../actions/runs/38527369787/attempts/2` + лог job «Golden-кадры» | Job-уровень: 3 смок-шарда, фронтенд, бэкенд (pytest в HA), перф-смок, предполёт — **success**; только job «Golden-кадры» **failure**, и лог показывает ровно два `different`: `version-mismatch-kiosk-attempted-dark-de` (sha `3ccd3e5…`) и `isometric-touch-kiosk-dark` (sha `160b33b…`) — оба sha256 **совпадают байт-в-байт** с принятыми в `114ebd2f`. Коммит несёт `Release:`+`Baseline-Reviewed:` на этот ровно run. Между `078c8bfd` (SHA той CI) и `114ebd2f` диффstat не трогает `src/**` — продуктовый код тот же, что гонялся в CI |

Не нашёл расхождений между заявленным в хэндоффе и перепроверенным самостоятельно.

### Чего не проверял

- `pytest tests_backend` сам не гонял: в этой среде ревью нет импортируемого
  `homeassistant` (нет `.venv-backend`), так что локальный прогон ничего не доказал
  бы (см. `docs/TESTING.md`/AGENTS.md про «HA harness NOT collected»). Полагаюсь на
  CI-job «Бэкенд: pytest в Home Assistant» = success на `078c8bfd` (проверено через
  `gh api .../jobs`, см. выше) — тот же код, что в HEAD.
- Мутанты из таблицы не исполнял и не применял патчи вручную — по правилу раунда
  это делает только ночной прогон; проверил регистрацию и соответствие
  `find`/`replace` реальным строкам диффа построчно (совпадают), логически
  прошёл каждую замену против утверждения теста (ловится).
- Полевой/GPU-рендер скриншотов и полный предрелизный набор (performance suite,
  полная golden-матрица локально) — не гейт этого ревью (§8), доверяю
  CI-атрибуции на точном SHA.
- Классификацию `release-ledger` не переигрывал полностью заново, но свёл её с
  тегом `v1.80.1`: дефект (безусловная кнопка «Изменить», `_clickRoom`, снятие
  флага без проверки) подтверждён чтением кода на теге — классификация
  `stable-fix` обоснована.

## Находки

Находок High или Medium нет.

Разобрал построчно каждый защитный AC из таблицы ТЗ против диффа:

| AC | Доказательство | Проверено |
|---|---|---|
| AC1 | unit (`roomAreaAffordance`/`deviceEditorAllowed`, полная матрица 2×2 и 2×2×2×2) + smoke `footer-matrix`/`touch-targets` по 9 ролям | исполнением |
| AC2 | smoke `direct-entry-refused` (0 запросов чанка, 0 записей, флаг цел) для nonwriter/admin-nonwriter/kiosk-ролей | исполнением |
| AC3 | smoke `late:*` (writer/kiosk/disconnect/newer) + `warm:*` — отозванное право/киоск/newer/disconnect не открывают диалог задержанного импорта; восстановленный тёплый диалог не красится при запрете | исполнением |
| AC4 | unit рантайма (ack не вызывается при запрещающем порте) + smoke `information-does-not-ack`, `allowed-entry-acks-once`, `second-entry-does-not-ack-again`, `kiosk-writer:lifecycle-new-device-preserved` (инверсия) | исполнением |
| AC5 | unit полная матрица `admin×writer×kiosk×plan` + smoke `area:*:{view,devices,decor,plan}:{visibility,navigation}`, `plan-no-link-title`, `plan-icon-drags` + 2 golden-кадра, принятых владельцем после полного CI | исполнением |
| AC6 | новый backend-тест `test_issue_844_houseplan_writer_is_not_ha_configuration_admin` (CI green, см. выше) + неизменные `test_issue_626_…`/`test_may_write_honours_explicit_admin_only_false` | исполнением (на CI) |
| AC7 | `smoke_card_controls`, `smoke_tap_ctx`, `smoke_kiosk`, `smoke_kiosk_scale_no_editor`, `smoke_room_fit` (перегнал сам) + новый инверсный мутант `view-edit-permission-hides-more-info` на реальный DOM-футер | исполнением |

Каждый защитный AC имеет непустую графу «чем краснеет» и зарегистрированный
мутант (`scripts/mutation-registry.mjs`) либо прямую проверку отрицательного
случая внутри смока/unit — пустых третьих столбцов нет.

Трейлеры: `Issue: #844` на каждом не-docs-коммите; `User-Visible: yes` только на
`b9134437`, где в этом же коммите правятся `docs/CHANGELOG.md` и
`docs/CHANGELOG.ru.md` — проверил текст обеих записей, совпадают по смыслу (RU/EN).
Golden-коммит `114ebd2f` несёт `Release:` + `Baseline-Reviewed: <run URL>`,
ссылка ведёт на реальный run с подтверждённым содержимым (см. выше) — не
изобретена.

Одно число — один источник (§8): `INITIAL_VIEW_GZIP_CEILING` правится один раз в
`scripts/bundle-budget.mjs` отдельным `chore(monolith)`-коммитом с обоснованием
(309653 B, +33 Б над прежней полосой); `npm run bundle:budget` подтверждает то же
число исполнением. `docs/release-ledger/v1.80.1/844.json`: `category: stable-fix`
обоснован сверкой с тегом `v1.80.1` — дефект (безусловная кнопка, `_clickRoom`,
снятие флага) в нём воспроизведён чтением (`git show v1.80.1:src/houseplan-card.ts`).

## Что проверено и корректно

- Предикаты `deviceEditorAllowed`/`roomAreaAffordance` — единственная точка
  логики, используются одинаково в футере карточки, прямом/отложенном/тёплом
  входе в диалог, ack нового устройства, клике по комнате и в рендере подписи;
  расхождений между проверкой клика и условием рендера нет.
- Fail-closed до ответа сервера не менялся (`_canManageConfiguration`,
  `houseplan-card.ts:1008-1011`) и подтверждён смоком `unknown-write:*:fallback`.
- Вход в Plan/Devices/Background уже требует `_canEdit && !_kiosk`
  (`houseplan-card.ts:757`), поэтому комбинация «в Plan, но не writer» в проде
  недостижима — `roomAreaAffordance` для неё не вычисляется отдельно, это не
  дыра, а следствие существующего гейта режима.
- Разрешённые View/kiosk-действия (service calls, more-info, карточка, замки,
  вписывание комнаты, resize киоска) не тронуты — перегнал смоки сам.
- Документация (UX-MODES, USER-GUIDE.ru/.md, ARCHITECTURE, DEVELOPMENT, STATUS,
  оба CHANGELOG, release-ledger) обновлена согласованно и терминологией из
  USER-GUIDE.ru.md, новых i18n-ключей нет (соответствует плану ТЗ).
- Golden: ровно два кадра поменялись, оба byte-identical с CI-attestation,
  остальные 203 неизменны — проверено по логам job, а не по заявлению автора.

## Вердикт

Зелёный. AC1–AC7 доказаны исполнением (автотестом, с подтверждённой
способностью теста/мутанта упасть) либо чтением там, где это явно
задекларировано и достаточно (отсутствует — здесь всё доказано исполнением).
High: 0, Medium: 0. Цикл не открывается.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/844-view-edit-permissions`, коммит `114ebd2f81b2` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `d337f0ac3bb4f44c8d7697959c49a59b28c7ff0b`
  ```
  git log --all --format='%H %T' | grep d337f0ac3bb4
  ```
- Тело issue: `bc1c6c6bd0b52ff9fc4a19793b42d93f1045c1bf82ba441e861e3a2826b07720`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQzNjYsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0NDU2fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxMjAsIm91dHB1dF90b2tlbnMiOjMxOTMzLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE1OTA0NiwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjY4NjkzMTcsImNvc3RVc2RFc3RpbWF0ZSI6Mi4zMjk2MTc0MDAwMDAwMDA1fV0sInR1cm5zIjo3MiwiZHVyYXRpb25NcyI6NjkxNDI4LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6Mi4zMzQwNzM0MDAwMDAwMDAzLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=4486 output_tokens=31951 cache_creation_input_tokens=159046 cache_read_input_tokens=6869317 num_turns=72 -->
