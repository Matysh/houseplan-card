# CODE-REVIEW-205-r2 — продолжение следа пылесоса после короткой остановки

- Issue: [#205](https://github.com/Matysh/houseplan-card/issues/205)
- Этап: `code` (PROCESS.md §2.7)
- Диапазон: `origin/dev...HEAD`, `origin/dev` = `5dc9016` («docs: review document
  for #204»), `HEAD` = `e158f8f` (ветка `issue/205-vacuum-trail-grace`, detached
  `HEAD`); merge-base — `5dc9016`
- ТЗ: [`docs/specs/205-vacuum-trail-resume-grace.md`](../specs/205-vacuum-trail-resume-grace.md),
  ревью ТЗ зелёное — [`SPEC-REVIEW-205-r1.md`](SPEC-REVIEW-205-r1.md)
- Предыдущий цикл: [`CODE-REVIEW-205-r1.md`](CODE-REVIEW-205-r1.md) —
  **зелёный**, High: 0, Medium: 0; вернулся не по замечаниям, а из-за конфликта
  ребейза на ушедший вперёд `dev` (issue-комментарии от 2026-08-19 17:53–17:58)
- Цикл: **r2/4**
- Ревьюер: Claude, свежая сессия, без переписки с автором реализации
- Вердикт: **зелёный**

## Скоуп ревью

После r1 ветка была отправлена в `S6-in-progress` не по существу правки, а
из-за конфликта при рейбейзе на `dev`, который тем временем принял #204
(«fix: show honest new-space display defaults», трогает `src/houseplan-card.ts`
и `src/space-dialog.ts`). Автор перебазировал `issue/205-vacuum-trail-grace` на
`origin/dev` (`5dc9016`) и запушил force-with-lease; новый `HEAD` — `e158f8f`.

Пять коммитов диапазона:

1. `5c09591` «docs: specify vacuum trail resume grace» — ТЗ (класс C), уже
   зелёное ревью (`SPEC-REVIEW-205-r1.md`), содержимое не пересматриваю заново.
2. `d31ad3c` «docs: review document for #205» — сам документ ревью ТЗ (класс C).
3. `56e0114` «fix: resume vacuum trails after short stops» — единственный
   продуктовый коммит (класс A/B), `Issue: #205`, `User-Visible: yes`, те же
   12 файлов, что были в `11b0283` на r1: `custom_components/houseplan/trails.py`,
   `demo/smoke_vacuum.mjs`, `scripts/mutation-gate.mjs`,
   `scripts/trail-resume-test-guard.mjs`, `tests_backend/test_trails.py`,
   `tests_backend/test_trail_recorder.py`, `docs/CHANGELOG.md`,
   `docs/CHANGELOG.ru.md`, `docs/STATUS.md`, `docs/TESTING.md`,
   `docs/USER-GUIDE.ru.md`, `docs/VACUUM.md`.
4. `edf532e` «docs: review document for #205» — документ ревью кода r1 (класс C).
5. `e158f8f` «docs: refresh rebased screenshot provenance» — новый для этого
   цикла коммит (класс C), `Issue: #205`, `User-Visible: no`: только
   `docs/images/06-device-editor.png` и `docs/images/screenshots.json`
   (обновлённый `sourceFingerprint`/`sourceSha256`/один `imageSha256`).

Прочитано целиком заново: `docs/SCOPE.md`, `AGENTS.md`, `PROCESS.md`, тело
issue #205 и все 8 комментариев (включая два новых — «слот S7 освободился»,
«код-ревью зелёное, но конфликт с dev» и «конфликт разрешён» с перечнем
локальных прогонов автора на Windows после ребейза), оба существующих
документа ревью (`SPEC-REVIEW-205-r1.md`, `CODE-REVIEW-205-r1.md`),
`docs/specs/205-vacuum-trail-resume-grace.md`, `docs/VACUUM.md` целиком, весь
diff `custom_components/houseplan/trails.py` (построчно), оба изменённых
тестовых файла целиком, оба скрипта mutation-gate/guard, все изменения в
changelog/`STATUS.md`/`TESTING.md`/`USER-GUIDE.ru.md`/`VACUUM.md`,
`scripts/source-fingerprint.mjs`.

## Что именно проверяет этот цикл

AGENTS.md прямо требует не считать повторное ревью формальностью: «после
ребейза на новый `dev` это другой код». Поэтому проверка строилась в два слоя:

1. **Тождество продуктового содержимого.** Сравнил diff `origin/dev...HEAD` по
   каждому из 12 файлов продуктового коммита с построчным разбором, записанным
   в `CODE-REVIEW-205-r1.md` — совпадает буквально (тот же `can_resume_trail_run`,
   те же условия `is None`/`is not None` в `on_point`/`end_run`, те же тестовые
   функции и та же mutation-запись). Прежний `HEAD` `11b0283` в этом чекауте
   недоступен как объект (ребейз переписал историю), поэтому тождество
   устанавливалось не через `git diff <old>..<new>`, а через построчную сверку
   текущего diff с тем, что r1 уже зафиксировал как проверенное и исполненное —
   это надёжнее, чем доверие тексту хендоффа, потому что сверяется с
   собственноручно перепроверенным прошлым циклом, а не с заявлением автора.
2. **Легитимность нового коммита ребейза.** `e158f8f` не трогает
   `custom_components/**` и не расширяет скоуп #205 — он синхронизирует
   provenance скриншотов с деревом `src/**`, изменившимся из-за #204.

### Почему `e158f8f` — корректное разрешение конфликта, а не посторонняя правка

`docs/images/screenshots.json.sourceFingerprint` — это `sha256` над
содержимым `src/**` плюс `package.json`/`package-lock.json`/
`rollup.config.mjs`/`tsconfig.json`/`scripts/source-fingerprint.mjs`
(`scripts/source-fingerprint.mjs`, читал целиком). До ребейза `205` не трогал
`src/**`, но принявший его `dev` уже содержал #204, который правит
`src/houseplan-card.ts` и `src/space-dialog.ts` — старое значение
`sourceFingerprint`, зафиксированное на branch #205 до ребейза, стало не
соответствовать актуальному дереву. Пересчитал сам:

```
node -e "import('./scripts/source-fingerprint.mjs').then(m => console.log(m.sourceFingerprint()))"
→ b86fe263f5e381c483534a0f7372a44478f5ef10b14416ee5c7a87e6f26a103d
```

совпадает с закоммиченным значением в `e158f8f` — не принято на слово.
Единственная изменившаяся картинка — `06-device-editor.png` (её `imageSha256`
изменился), остальные девять сценариев сохранили прежний `imageSha256` —
согласуется с тем, что #204 меняет именно поведение редактора устройств
(`src/space-dialog.ts`), а не View/другие поверхности.

Дополнительно исполнил `node demo/docs/capture.mjs` в этой среде, чтобы
эмпирически проверить регенерацию — все десять PNG получились с другим
побайтовым содержимым, чем закоммиченные (не только `06-device-editor.png`).
Разобрался: это межсредовой шум рендера (шрифты/GPU текущего Linux-песочницы
против среды, где скриншоты реально захватывались), а не дефект коммита —
даже нетронутые этим коммитом файлы (например `01-view-desktop.png`)
регенерировались иначе. Захват PNG не детерминирован между машинами по
конструкции инструмента; коммит проверяется через `sourceFingerprint` (числовой
хеш, воспроизведён точно), а не через побитовое совпадение растра. Откатил
локальную регенерацию (`git checkout -- docs/images/`), в рабочем дереве
чисто. Это не входит ни в один обязательный гейт (не diff рендера/геометрии/
стилей — `npm run golden:verify` для скриншотов документации не применяется),
поэтому не аргумент против коммита, а дополнительная, необязательная проверка.

## Как проверялось (гейты этого цикла)

Зависимости и Chromium уже установлены средой ревью; `npm ci` не запускался.
Backend Python в этой среде без `pytest`/`voluptuous` — оба установлены
`pip install` перед прогоном (сеть доступна), как и в r1, чтобы гейт был
реальным исполнением.

| Гейт | Команда | Результат |
|---|---|---|
| Типы | `npx tsc --noEmit` | green |
| Unit | `npm test` | **919/919** green (912 в r1 + 7 новых от вошедших между `ad8e7a5` и `5dc9016` коммитов дерева `dev`, включая #204; ни один тест не относится к #205 и не изменился по содержанию #205) |
| Сборка + синхронность бандлов | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js && cmp dist/houseplan-card.js demo/srv/assets/houseplan-card.js` | green, обе копии байт-в-байт совпадают |
| Whitespace | `git diff --check origin/dev...HEAD` | чисто |
| Backend — targeted | `python -m pytest tests_backend/test_trails.py tests_backend/test_trail_recorder.py -q` | **37 passed** |
| Backend — полный pure/stub набор | `python -m pytest tests_backend -q` (после установки `pytest`+`voluptuous`) | **172 passed** — то же число, что в r1 |
| Целевой смок (назван в AC8) | `node demo/smoke_vacuum.mjs` | `OK` |
| Mutation guard (AC10), точечно | `node scripts/mutation-gate.mjs --id=vacuum-trail-resume-disabled` | `ok чистый прогон` → `ok vacuum-trail-resume-disabled: тест покраснел, как обязан` → `поймано 1 из 1` |
| Mutation gate, полный набор | `node scripts/mutation-gate.mjs --check` | все **36** мутантов пойманы (35 + новый на r1, число не изменилось — конфликт ребейза не потерял и не задвоил запись) |
| Провенанс скриншотов (доп., не гейт) | `node -e "…sourceFingerprint()…"` | совпадает с закоммиченным значением `e158f8f` |
| Документные ссылки (доп., не гейт) | `node scripts/check-docs.mjs --external` | `Documentation checks passed (7 files, 10 external links)` |

Не прогонялись (соразмерность гейта, PROCESS.md §8) — по тем же причинам, что
и в r1, диапазон этого цикла их не меняет: полный набор из 127 браузерных
смоков (единственный релевантный, `smoke_vacuum.mjs`, прогнан), `npm run
golden:verify` (diff не трогает ни один файл рендера/геометрии/стилей;
провенанс документационных скриншотов — не golden-гейт и проверен отдельно
выше), performance-профили (в AC не названы, алгоритм O(1) на точку не
менялся с r1). Полный HA-harness backend — канонически только Linux CI
(`.venv-backend` недоступен в среде ревью).

### Проверка дисциплины «тест умеет падать»

Как и в r1 — не поверил заявлению автора «mutant caught (1/1)» из комментария
после ребейза, а повторил сам: `node scripts/mutation-gate.mjs
--id=vacuum-trail-resume-disabled` патчит `resumed = bool(cur and
can_resume_trail_run(cur, map_id, now))` → `resumed = False`, гоняет
таргетированный `scripts/trail-resume-test-guard.mjs` и подтверждает, что при
отключённом resume фокусный набор краснеет, а на чистом дереве — зелёный.

## Построчная проверка кода против контракта ТЗ (раздел 6)

Diff `custom_components/houseplan/trails.py` в этом цикле идентичен тому, что
разобран построчно в `CODE-REVIEW-205-r1.md` (та же сигнатура
`can_resume_trail_run`, тот же порядок проверок `map_id`/`bool`/`isinstance`/
`math.isfinite`, те же изменённые условия в `on_point`/`end_run`). Повторно
прогнал каждый пункт контракта против исполняемых тестов на текущем `HEAD`, а
не принял вывод r1 как данность:

- **П.1–3 (resume при совпадении map_id и grace; жёсткая граница на другой
  карте; включительная граница 30:00)** — `test_ended_run_resumes_within_grace_and_duplicate_is_a_change`,
  `test_resume_grace_is_inclusive_then_rotates_after_epsilon`,
  `test_resume_never_crosses_maps_and_malformed_timestamps_fail_closed` —
  исполнены на `HEAD`, зелёные.
- **П.4 (дубликат точки после resume → `changed=True`, точка не
  добавляется)** — тот же тест, значение `resumed` возвращается корректно.
- **П.5 (malformed/bool/nan/inf/clock rollback fail closed)** — тот же тест
  плюс `test_resume_fails_closed_on_clock_rollback_and_survives_restart_shape`
  — исполнены.
- **П.6 (idempotent `end_run`)** — `end_run` использует `cur.get("ended") is
  None`, подтверждено `test_repeated_short_stops_keep_all_points_and_existing_previous`.
- **П.7 (`unavailable`/`unknown`/missing нейтральны)** — ветка `_sample` не
  менялась, recorder-тест `test_short_available_stops_resume_one_run_and_neutral_states_do_not_shift_window`
  подтверждает.
- **П.8 (единый контракт для любого available non-moving state)** —
  `test_any_available_nonmoving_state_uses_the_same_grace_contract`
  (`paused`, `idle`, `error`, `washing`, `docked`) — исполнен.

## Проверка AC1–AC11

Идентична r1 по существу — тот же код, те же тесты, все исполнены на
рейбейзнутом `HEAD` в этой сессии:

| AC | Статус | Как доказано в этом цикле |
|---|---|---|
| AC1 | Доказан | `test_ended_run_resumes_within_grace_and_duplicate_is_a_change`, `test_short_available_stops_...` — исполнены. |
| AC2 | Доказан | `test_resume_grace_is_inclusive_then_rotates_after_epsilon` — исполнен. |
| AC3 | Доказан | `test_resume_never_crosses_maps_...` — исполнен. |
| AC4 | Доказан | тот же тест, проверены и `points`, и возвращаемое значение. |
| AC5 | Доказан | `test_repeated_short_stops_keep_all_points_and_existing_previous` — исполнен. |
| AC6 | Доказан | `test_short_available_stops_...` + `test_any_available_nonmoving_state_...` — исполнены. |
| AC7 | Доказан | `test_resume_fails_closed_on_clock_rollback_and_survives_restart_shape` — исполнен. |
| AC8 | Доказан | `node demo/smoke_vacuum.mjs` → `OK`; `_renderVacuums` по-прежнему не читает `ended` (код `src/houseplan-card.ts` не тронут ни #205, ни ребейзом на этом участке). |
| AC9 | Доказан | Полный прогон `tests_backend/test_trails.py` + `test_trail_recorder.py` (37 тестов), включая нетронутые source-health/two-floor/decimation/delete/map-switch кейсы. |
| AC10 | Доказан | Mutation guard перепроверен самостоятельно, красный при отключённом фиксе, зелёный на исходном коде. |
| AC11 | Доказан | Таблица гейтов выше — все зелёные, исполнены в этой сессии на текущем `HEAD`. |

## Находки

Ни одной **High**. Ни одной **Medium**. Ни одной **Low**.

Продуктовый код, тесты и mutation-запись — тождественны r1 (уже принятому
зелёным); единственный новый в этом цикле коммит (`e158f8f`) — легитимное,
проверенное пересчётом хеша разрешение конфликта ребейза вне продуктовых
файлов. Оснований для новых замечаний нет.

## Что проверено и признано корректным

- **Причина и контракт ТЗ реализованы буквально** — не переоткрывал заново
  «с нуля», а сверил текущий diff с уже построчно разобранным в r1 построчным
  разбором, затем перепроверил каждый пункт исполнением соответствующего теста
  на текущем `HEAD` — совпадение полное.
- **Ребейз не изменил семантику.** 12 файлов продуктового коммита `56e0114`
  идентичны по содержанию 12 файлам `11b0283` из r1 (сверено файл за файлом);
  расхождения есть только в `docs/STATUS.md` (естественно упоминает #204
  вместо старого перечня issue-веток) — не поведенческое расхождение.
- **Тесты умеют падать, не только показывают зелёное.** Собственноручно
  воспроизвёл mutation-guard (AC10) на рейбейзнутом дереве.
- **Гейты воспроизведены самостоятельно** на новом `HEAD`, не переписаны из
  комментария автора после ребейза: typecheck, 919/919 unit, сборка + три
  синхронные копии бандла, 172 backend pure/stub теста, целевой смок, полный
  mutation-gate (36/36).
- **Провенанс скриншотов легитимен.** `sourceFingerprint` пересчитан
  независимо и совпадает; изменившийся `06-device-editor.png` объясняется
  тем, что #204 меняет именно поведение редактора устройств.
- **Документация и трейлеры.** Оба changelog правлены в том же коммите, что и
  код (`User-Visible: yes`); коммит ребейза (`e158f8f`) — `User-Visible: no`,
  корректно для чисто документационной синхронизации. Ветка соответствует
  трейлерам `Issue: #205`. `git diff --check` чист.
- **Не расширяет скоуп.** Diff идентичен r1 по продуктовым файлам; новый
  коммит этого цикла — только `docs/images/**`, вне `custom_components/**` и
  `src/**`.

## Чего не проверял

- **Полный набор из 127 браузерных смоков** — не запускал; diff не касается
  canvas/редакторов/other rendering surfaces сверх уже названного в AC8
  `smoke_vacuum.mjs`, который исполнен явно.
- **`npm run golden:verify`** — не запускал; diff не меняет ни один файл
  рендера/геометрии/стилей продукта.
- **Побайтовое совпадение регенерированных документационных PNG** —
  сознательно не использую как критерий: перезахват скриншотов в этой среде
  дал другие байты даже для файлов, не тронутых этим коммитом (шрифты/GPU
  Linux-песочницы отличаются от среды исходного захвата). Легитимность
  коммита проверена через `sourceFingerprint` (детерминированный хеш
  исходников), а не через растр.
- **Полный HA-harness backend (`test_ha_*.py` с реальным Home Assistant)** —
  в среде ревью нет `.venv-backend`/пакета `homeassistant`; канонический
  прогон — Linux CI на точном SHA.
- **Perf-профили** — не названы в AC, изменение O(1) на точку не менялось с
  r1.
- **Живой робот/симулятор демо-стенда** — вне цикла код-ревью без ручного
  тестирования.
- **Возможное визуальное склеивание двух реальных уборок в пределах 30
  минут** — явно принятый владельцем trade-off (раздел 6 ТЗ), не дефект.

## Вердикт

**Зелёный · цикл r2/4 · High: 0 · Medium: 0 → нет новых issue.**

Продуктовое содержимое не изменилось со времени зелёного r1 — сверено файл за
файлом и перепроверено исполнением всех тестов и гейтов на рейбейзнутом
`HEAD`, а не принято на слово ни из r1, ни из комментария автора после
ребейза. Единственный новый в этом цикле коммит синхронизирует provenance
документационных скриншотов с деревом, куда за время ожидания слота `S7`
вошёл #204; легитимность проверена независимым пересчётом
`sourceFingerprint`, а не принята на веру. Следующий статус — очередь на
пре-релиз (`S8-merged` после мёржа в `dev`).
