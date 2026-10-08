# CODE-REVIEW-826-r1

Материал: `2930162a6873477a1d70579e86ab9f536cd4a40f` (`issue/826-candidate-alias-parity`, 2 коммита на `origin/dev=f9557cfc`). Трек: ask. Заход r1, блокирующих циклов 0/4.

## Скоуп

ТЗ #826 (принято зелёным на r1, hash `6ce5f323a4a3`) чинит три находки beta.8:
- **F44** — TS-кандидат удаления пространства (`createSpaceDeletionCandidate`) не обнулял `stair.target_space_id` у лестниц, ведущих в удаляемое пространство, в отличие от Python; добавлена также защита от обработки уже-удалённого (missing) `spaceId`.
- **F46** — `adoptWallSegmentModelCandidateInPlace` мутировал общий (aliased) numeric point-array на месте, затирая координаты чужой комнаты/этажа, если тот же JS-массив-точка использовался в двух местах модели.
- **F45** — недостижимый `HouseplanOnboardingRuntime._deleteSpace` (онбординг не передаёт `deleteSpace` в форму) вызывали только смоки; метод и его неиспользуемый импорт удалены, общий `completeSpaceDeletion`/editor-путь остаются.

Риск по изменённым участкам (#707): geometry `src/wall-segment-model.ts:907` (участок `wall-*`) покрыт контрактом AC2/AC3 ТЗ (п.5 "scalar-point arrays... identity не обещается") и доказан исполняемыми тестами/смоками — разобрано ниже.

## Как проверялось

Дешёвые гейты (`tsc --noEmit`, `npm test`, `npm run build`+bundle-policy) подтверждены зелёным Validate на этом SHA (run `37769962122`, `headSha=2930162a6873477a1d70579e86ab9f536cd4a40f`, `conclusion=success` — проверено `gh run view`). По диффу и AC гонял сам:

| Гейт | Команда | Результат |
|---|---|---|
| Unit (новые/изменённые файлы) | `node --test test/wall-adoption-alias.test.mjs test/space-deletion.test.mjs test/space-delete-dialog.test.mjs` (после `tsc -p tsconfig.test.json && fix-test-build.mjs`) | 34/34 PASS |
| Red-witness AC2 | мутация `src/wall-segment-model.ts` (удалена строка `if (next.every(...)) return next.slice();`) | 6/7 тестов `wall-adoption-alias` красные (7-й, без алиасинга, остаётся зелёным — ожидаемо) |
| Red-witness AC1 (stairs) | мутация `src/space-deletion.ts` (`stair.target_space_id = null` → комментарий) | `#819 паритет с сервером на общей фикстуре` красный на stair-кейсе |
| Red-witness AC1 (absent target) | мутация `if (!spaces.some(...))` → `if (false)` | `#826 absent target never cleans dangling stairs, maps or placements` красный |
| `scripts/mutation-gate.mjs --check` | — | PASS; browser guards **288/200** (совпадает с заявленным), 4 предупреждения реестра (совпадает) |
| `scripts/model-invariants.mjs --config test/fixtures/281-resize-outer-candidate.json --json` | — | `violations: [], notes: []` |
| Смоки по прямому совпадению `smoke-select.mjs --json` (14) + зарегистрированный (1) | `smoke_wall_adoption_alias`, `smoke_resize_pointer_real_plan --alias-ownership`, `smoke_space_delete_with_devices`, `smoke_post_write_adoption`, `smoke_danger_confirmation`, `smoke_orphan_space_references`, `smoke_optional_space_model`, `smoke_backdrop_guard`, `smoke_discard_copy`, `smoke_plan_upload_race`, `smoke_plan_upload_reject`, `smoke_binding_picker`, `smoke_danger_confirm_branches`, `smoke_decor_images`, `smoke_hidden_flag`, `smoke_registryless_opening` | все 16 PASS (после `npm run build && node scripts/bundle-sync.mjs`) |
| Red-witness AC3 | `node demo/smoke_resize_pointer_real_plan.mjs --alias-ownership --alias-red-witness` на мутированном `wall-segment-model.ts` | `resize_pointer.alias_unrelated_floor_and_refs_unchanged: expected true, got false` — краснеет именно так, как заявлено автором |
| Python parity (чтение, не исполнение) | сверка `websocket_api.py:1955-1958` (stair-clear) и `:2161-2165` (`space_not_found` до вызова `_space_delete_target`) с TS-кандидатом | совпадает построчно с контрактом AC1 |
| `node scripts/inventory.mjs` / `node scripts/status-snapshot.mjs --check` | — | расхождение найдено, см. находку ниже |

Рабочее дерево восстановлено (`npm run bundle:clean`) после проверки мутантов и сборки; `git status` чист на момент публикации документа.

Не гонял: `pytest tests_backend` (HA-харнесс недоступен в этой среде — нет `.venv-ci`/`.venv-backend`; поведение проверено чтением исходника backend, не исполнением), полный `golden`/полную несвязанную smoke-матрицу, реальные мутанты всего реестра (ночная обязанность, не гейт ревью), `npm run gate:small -- --smokes` целиком (прогнал 16 из заявленных 55 точечно — прямые совпадения из `smoke-select --json`, остальные 39 — «слабая связь», выбор автора прогнать их все в батче признаю достаточным по совпадению посчитанного числа 55 с заявленным).

## Находки

### Low — `docs/STATUS.md` Node-unit снимок не совпадает со своим генератором (сниму сам)

`docs/STATUS.md:23` на этом SHA заявляет `Node unit 3875`. Запуск `node scripts/inventory.mjs` на чистом `2930162a` даёт **3876**, и `node scripts/status-snapshot.mjs --check` сам говорит `snapshot block is stale`. Причина — не #826: базовое число на `origin/dev` (`3872`) само было занижено на 1 относительно фактического подсчёта по исходникам на том коммите (проверено: `git show origin/dev:<test>.mjs` + та же regex даёт **3873**, не 3872). Дельта, которую добавил #826 (+3 — два новых `test(`-блока в `wall-adoption-alias.test.mjs`, один в `space-deletion.test.mjs`, остальные правки — это переиспользованные `for`-циклы и изменение значения внутри существующего теста, не новые строки `test(`), посчитана верно; просто она применена к уже устаревшей базе, а не к пересчитанному числу. `status-snapshot.mjs --check` не подключён ни к `gate:small`, ни к `process-gate.mjs`, поэтому ни один гейт это не ловит. Не влияет ни на один AC, не видно пользователю, не блокирует. Снимаю как Low с записью — не дефект этой задачи, а невидимая никому строка внутреннего снимка; при желании поправить — отдельный `node scripts/status-snapshot.mjs --write`.

## Что проверено и корректно

- **AC1** (`space-deletion.ts:150-154`): после фильтрации удаляемого пространства из `config.spaces` цикл по оставшимся пространствам обнуляет `target_space_id` только у лестниц, указывавших на удалённое пространство; чужие/null/legacy-записи не трогаются. Параллель с Python (`websocket_api.py:1955-1958`) — дословная. Подтверждено исполнением общей фикстуры (34/34) и red-witness.
- **AC1 (отказ при отсутствующей цели)**: ранний возврат `space-deletion.ts:133-135` возвращает уже клонированные `config`/`layout` без изменений, если `spaceId` не найден среди `spaces`; входные объекты (`configIn`/`layoutIn`) не мутируются, т.к. `clone()` вызывается до проверки. Backend уже отвергает `space_not_found` до вызова pure-кандидата (`websocket_api.py:2161-2165`) — новый `test_issue_826_absent_space_delete_preserves_dangling_references` (tests_backend) лишь документирует существующее поведение через `monkeypatch` на `async_save`, подтверждая нулевые записи. Прочитано, логика согласована с TS-зеркалом.
- **AC2/AC3** (`wall-segment-model.ts:902-938`): новая ветка `if (next.every(item => item === null || typeof item !== 'object')) return next.slice();` перехватывает скалярные (точечные) массивы ДО попытки `current.splice(...)` по месту — именно это раньше мутировало общий JS-массив-точку и портило другого владельца (F46). Root/id-bearing объекты по-прежнему идут через ветку с `id`-картой и сохраняют ссылочную идентичность (проверено `assert.equal(ref, afterRef)` в тестах и живым Resize-смоком). Candidate не мутируется (`next.slice()` — новый массив, ссылка кандидата нигде не отдаётся наружу). Byte-idempotence подтверждена повторной адопцией в тесте. Реальный pointer-смок (`smoke_resize_pointer_real_plan --alias-ownership`) создаёт настоящий JS-алиас (`other.rooms[1].poly[3] = point`, не JSON-копию) на отдельном этаже, коммитит два реальных Resize через мышь и проверяет и значения, и ссылочную идентичность — красный без фикса, зелёный с ним (оба состояния воспроизведены лично).
- **AC5** (reachability): `grep` по `src/` подтверждает единственный живой путь — `houseplan-card.ts:9810` → `houseplan-editor-runtime.ts:8315` → `editors/space-settings-dialog.ts` → `editors/space-form.ts` (кнопка Delete рендерится только при переданном порте). Онбординг-порт `deleteSpace` не передаёт. Смоки, раньше звавшие `onboarding._deleteSpace()` напрямую, переписаны на клик по реальной DOM-кнопке (`demo/smoke_danger_confirmation.mjs`, `demo/smoke_post_write_adoption.mjs`); оставшиеся вызовы `card._deleteSpace()` (`smoke_orphan_space_references.mjs`, `smoke_optional_space_model.mjs`) идут через делегата card→editor, не через удалённый метод — проверено исполнением, все PASS.
- **AC6**: три новых мутанта в `scripts/mutation-registry.mjs` (`wall-adoption-mutates-shared-point-owners`, `space-delete-mirror-keeps-incoming-stairs`, `space-delete-mirror-cleans-an-absent-target`) лично воспроизведены вручную как RED→GREEN на named-assertion уровне (не grep). `mutation-gate --check` подтверждает уникальность якорей и отсутствие роста browser-only guard'ов сверх заявленного (288/200, 4 предупреждения — совпадает с заявлением автора).
- **Инвентарь подтверждений** (`danger-confirmation.test.mjs`): уменьшение `sharedCalls.length` 8→7 перепроверено отдельным grep по регулярке теста (`/await this(?:\.host)?\._confirmDanger\s*\(\{/g`) по всем `src/*.ts` — ровно 7 совпадений после удаления онбординг-метода (было 8, включая удалённый). Число не взято на веру.
- **Трейлеры**: оба коммита несут `Issue: #826`; `User-Visible: yes` стоит только на коммите, который трогает оба `docs/CHANGELOG*.md` в том же коммите (стат подтверждён `git show --stat`). Текст changelog корректно ограничен видимым эффектом (устойчивость geometry-адопции при алиасинге); TS/Python-паритет лестниц и удаление недостижимого адаптера справедливо не объявлены новым UX — это согласуется с п.9 ТЗ.
- **Канон**: `docs/ARCHITECTURE.md`, `docs/STAIRS.md`, `docs/DEVELOPMENT.md`, `docs/STATUS.md` обновлены синхронно с поведением (кроме отмеченной Low-находки).
- **Risk-строка трека ask**: единственный названный риск (`wall-segment-model.ts:907`, geometry) покрыт AC2/AC3 ТЗ и подтверждён исполнением, включая red-witness на реальном браузерном pointer-пайплайне, а не только на unit-уровне.

## Чего не проверял

- `pytest tests_backend` — не исполнял (нет HA-харнесса в этой среде); поведение сверено чтением `websocket_api.py` вокруг `_space_delete_target`/`space_not_found`, совпадает с TS-зеркалом и с заявленным автором прогоном (1155 passed).
- Полный `golden`, полная несвязанная smoke/performance-матрица, реальные mutants всего реестра — вне объёма ревью на `ask` (предрелизная обязанность, явно отмечено автором как не прогнанное и это корректно: задача не трогает рендер/CSS).
- Из 55 смоков, заявленных в `gate:small -- --smokes` (54 "direct" по JSON-выдаче `smoke-select` + 1 зарегистрированный — число перепроверено пересчётом `smoke-select.mjs --json`, совпадает), я лично прогнал 16 (все прямые текстовые совпадения + зарегистрированный); оставшиеся 39 — записи с распространёнными символами (`_spaceDialog`, `spaceId`), которые текстовый режим скрипта относит к «слабой связи» и оставляет на суждение ревьюера. Не прогонял их по отдельности — полагаюсь на заявленный прогон автора в составе общего гейта.
- `#832`/`#831` — явно выведены автором за периметр #826, не проверялись и не должны проверяться здесь.

## Вердикт

High: 0. Medium: 0 (единственная находка — Low, снята с записью, не образует цикл). Все AC1–AC6 доказаны исполняемыми тестами с подтверждённой красной стороной (не только чтением), геометрический риск из risk-строки трека ask покрыт.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/826-candidate-alias-parity`, коммит `2930162a6873` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `192303c6b74026884051cb27e2c2c1792897a000`
  ```
  git log --all --format='%H %T' | grep 192303c6b740
  ```
- Тело issue: `6ce5f323a4a327b015c08a76a30c4f567d97e3ff99227d80785048999af407a8`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:usage input_tokens=4213 output_tokens=42360 cache_creation_input_tokens=137351 cache_read_input_tokens=8064435 num_turns=85 -->
