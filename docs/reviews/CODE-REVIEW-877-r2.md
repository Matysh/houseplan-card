# CODE-REVIEW-877-r2

Issue: #877 · трек: show · заход r2 · блокирующих циклов использовано 0 из 2

Материал: `a9ae4fde8ea65fba8154a63e6055db7b9151aa52` (рабочая копия на этом SHA).
`git merge-base origin/dev HEAD` = `cd59f346501c11fa43a601de98681f75a608f14c`
= `origin/dev` — ветка стоит точно на вершине `dev`, слияние будет fast-forward
и чистым.

## Почему r2, а не продолжение r1

r1 был зелёным (0 High, 0 Medium) на SHA `5314361e`. Пока ревью шло, `dev`
продвинулся (нужен был отдельный коммит #882, чинивший саму процедуру
подхвата материала при продолженном слиянии), и пайплайн запросил свежего
кандидата (событие #856) вместо завершения слияния по старому дереву —
это не возврат автору, а конвейерное продолжение; бюджет циклов не тратился
(`блокирующих циклов 0/2`, как и в r1). Автор перебазировал ветку на новый
`dev` (`ecce276e` → `a9ae4fde`), код задачи не трогал; единственный конфликт
был в генерируемом `docs/reviews/INDEX.md`, пересобран скриптом.

## Скоуп

Мастер повторной установки (`custom_components/houseplan/config_flow.py`,
`previous_data.py`) не показывает «Previous installation found», когда прежняя
модель достоверно без пространств (`spaces == 0`, независимо от маркеров и
наличия config-файла), а layout-хранилище не содержит незавершённой парной
записи (`optimize_pending`). После подтверждения финальной формы набор уходит
в архив тем же путём, что «Начать с чистого листа». Решение владельца
2026-10-13 зафиксировано в теле issue; трек show подтверждён (одна
поверхность, без миграции/i18n/perf/touch). Закрывает J4/J6 (`docs/SCOPE.md`).

Скоуп не изменился со времён r1 — см. «Унаследовано из r1» ниже.

## Риск по изменённым участкам (#707)

Промпт этого раунда вновь поднимает `store.py:18` (новый импорт
`OPTIMIZE_PENDING`) и `store.py:158` (удалённое определение) как класс
`migration`. Перепроверено на текущем SHA: хунк в `store.py` байт-в-байт
совпадает с тем, что разобран в r1 (см. «Унаследовано» ниже, пункт 1) —
перенос строковой константы `"optimize_pending"` в `const.py`, реэкспорт
через `store.py` сохраняет оба существующих импорта
(`store.OPTIMIZE_PENDING`, `websocket_api.py:103-108`), формат самого ключа и
`STORAGE_VERSION`/`STORAGE_MINOR_VERSION` не меняются, ключ уже документирован
в `docs/CONFIG-COMPATIBILITY.md` § «Crash-resumable config/layout pairs
(#491)» (строка 103–105, проверено на этом SHA — текст раздела не менялся).
Это не миграция. **route: fix**, реклассификация не требуется — вывод r1
подтверждён на новом материале, а не просто принят на слово.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где видно |
|---|---|---|
| — (находок не было, вердикт зелёный 0/0) | н/п | н/п |

r1 не возвращал находок автору — единственное отличие r2 от r1 это смена
базового SHA из-за ребейза на ушедший вперёд `dev` (см. раздел выше).

## Унаследовано из r1

Документ `docs/reviews/CODE-REVIEW-877-r1.md` (материал `5314361e...`, дерево
`9fbaafcfb690...`), вердикт зелёный, 0 High/0 Medium. Проверено построчным
сравнением диффа `origin/dev...HEAD` на обоих материалах — содержимое всех 14
файлов продукта/тестов идентично r1 (см. «Как проверялось» ниже), поэтому
принимается без повторного построчного разбора:

1. Логика `empty` в `previous_data.py` (`_layout_settled`, короткое замыкание
   `spaces == 0 and _layout_settled(...)`, layout читается только после того,
   как config уже дал 0 пространств) и её тестовое покрытие коротким
   замыканием (`test_layout_read_only_without_spaces`).
2. `config_flow.async_step_user()`: `found and empty` → `_start_fresh=True` без
   перехода в `previous_data`; архивация только на подтверждении формы.
3. Перенос `OPTIMIZE_PENDING` в `const.py`, реэкспорт из `store.py`, причина
   (#436 — `previous_data.py` обязан быть HA-независимым).
4. Таблица защитных AC (AC1/AC2/AC3) с пятью мутантами `reinstall-*` и
   названными гард-тестами — пустых третьих столбцов нет.
5. Трейлеры коммитов `026fa8e8` (`Issue:#877`, `User-Visible: yes`, оба
   changelog) и `180b3026` (`Issue:#877`, `User-Visible: no`, docs-only).
6. Классификация `docs/release-ledger/v1.80.1/877.json` — `stable-fix` против
   `v1.80.1`, обоснование не оспорено.
7. Обновления `docs/USER-GUIDE.{ru.,}md`, `ARCHITECTURE.md`, `STATUS.md` —
   терминология не изобретена.

## Как проверялось (этот раунд)

Дельта раунда — исключительно смена базового SHA (ребейз) плюс один
мехнический коммит `a9ae4fde` (регенерация `docs/reviews/INDEX.md`). Это
формально подпадает под «ребейз на ушедший вперёд dev» (повод для полного
разбора, не только дельты), поэтому проверка велась не на доверии к r1, а
построчным сравнением:

- `git show 026fa8e8 -- custom_components/houseplan/{config_flow,const,previous_data,store}.py` —
  тот же коммит-хэш, что был в материале r1 (рядом с которым r1 вёл разбор);
  rebase его не тронул (нет конфликта), содержимое идентично построчно тому,
  что процитировано и разобрано в r1.
- `git diff origin/dev...HEAD --stat` на текущем SHA — те же 16 файлов (минус
  сам `CODE-REVIEW-877-r1.md` и `INDEX.md`, которые и есть новый материал этого
  раунда), построчно те же диффы в `config_flow.py`, `const.py`,
  `previous_data.py`, `store.py`, `tests_backend/test_previous_data.py`,
  `tests_backend/test_ha_config_flow.py`, `scripts/mutation-registry.mjs`,
  docs (`ARCHITECTURE.md`, `STATUS.md`, `USER-GUIDE{.ru,}.md`,
  `CHANGELOG{.ru,}.md`, `release-ledger/v1.80.1/877.json`).
- `git log --oneline origin/dev~5..origin/dev`: пять новых коммитов на `dev`
  — все #882 (ci-инфраструктура подхвата материала ревью) и ревью-документ
  #885; ни один не трогает `custom_components/houseplan/**` или
  `tests_backend/**` из скоупа этой задачи — подтверждено тем, что
  `git diff origin/dev...HEAD --stat` не показывает конфликтных/затронутых
  общих файлов, кроме `docs/reviews/INDEX.md`.
- `git show a9ae4fde -- docs/reviews/INDEX.md` — чисто механическая правка
  (счётчик документов 43→44, issue 28→29, одна вставленная строка для
  `CODE-REVIEW-877-r1.md`, зелёная 0/0) — это конфликт ребейза, разрешённый
  генератором `scripts/reviews-index.mjs`, не ручная правка.
- CI на точном SHA материала (а не на старом, как в r1): `gh run view
  38454981478` → `headSha = a9ae4fde...` (точное совпадение). Джобы:
  «Классификация изменённых файлов», «Предполёт: документация, провенанс,
  процесс», «Фронтенд: типы, юниты, мутанты, синхрон бандла», «HACS:
  валидация репозитория», «Переиспользование: это дерево уже проверено»,
  «Hassfest», «Бэкенд: pytest в Home Assistant», «Доказательство выполненных
  проверок» — все **success**. «Мутанты по диффу», «Геометрия: TS/Python
  parity», смоки, golden, performance, «Бандл головы dev» — **skipped**
  (ожидаемо: трек show не гоняет мутанты в разработке, фронтенд-дифф
  отсутствует).
  Важное отличие от r1: там «Бэкенд: pytest в Home Assistant» подтверждался
  только на материале предыдущего SHA (`5314361e`), здесь — **прямо на SHA
  этого раунда** (`a9ae4fde`), это строже, не слабее доказательство.
- Джоб «Переиспользование: это дерево уже проверено» — success; это
  независимое от моего чтения подтверждение, что дерево продукта
  идентично уже провалидированному (соответствует тому, что коммит
  `026fa8e8` не менялся ребейзом).

## Таблица защитных AC (§2.7) — унаследована, подтверждена исполнением на этом SHA

| AC | Чем доказан (тест, исполнение) | Чем краснеет (мутант реестра) |
|---|---|---|
| AC1 — без пространств, без меню, финал как Start fresh | `test_spaceless_starts_fresh_without_menu` (markers/no-markers/no-config), `test_spaceless_cancel_changes_nothing`, `test_spaceless_archive_failure_never_creates_entry`, `test_spaceless_is_empty` — job «Бэкенд: pytest в Home Assistant» зелёный на `a9ae4fde` | `reinstall-skip-keeps-spaceless-set`, `reinstall-empty-ignores-space-count`, `reinstall-empty-trusts-unknown-config` |
| AC2 — есть пространство → меню как раньше | `test_previous_data_menu`, `test_restore_previous_data`, `test_start_fresh` (markers/no-markers), `test_one_space_is_not_empty` | `reinstall-empty-ignores-space-count` |
| AC3 — неизвестное/pending ≠ пустое, меню остаётся | `test_unknown_previous_data_keeps_menu` (6 кейсов), `test_unknown_is_not_empty`, `test_unsafe_is_not_empty` | `reinstall-empty-trusts-unknown-config`, `reinstall-empty-ignores-pending-pair`, `reinstall-empty-trusts-broken-layout` |

Пустых третьих столбцов нет. Мутанты не запускались (трек show, #709) — имена
гард-тестов в реестре (`scripts/mutation-registry.mjs`, 5 записей `reinstall-*`)
сверены grep'ом с реально существующими функциями в
`tests_backend/test_ha_config_flow.py` на текущем SHA — совпадение полное.

## Находки

Нет High. Нет Medium. Нет Low.

Код на `a9ae4fde` соответствует ТЗ и решению владельца буквально — то же, что
установил r1, подтверждено построчным сравнением, а не доверием к прежнему
вердикту. Трейлеры, changelog, release-ledger и документация подсистемы не
менялись с r1 и остаются корректными.

## Что проверено и корректно

- Идентичность продуктового кода и тестов r1 → r2 (построчное сравнение
  диффов, см. «Как проверялось»).
- Коммит `026fa8e8` (сам фикс) не тронут ребейзом — тот же хэш, что был в
  материале r1.
- Единственное изменение раунда — конфликт ребейза в генерируемом
  `docs/reviews/INDEX.md`, разрешённый штатным генератором, без ручного
  вмешательства в его содержимое помимо вставки строки.
- Пять новых коммитов на `dev` (#882, #885) не пересекаются с файлами скоупа
  задачи.
- Риск по `store.py` (класс `migration`) — не миграция, документировано в
  `CONFIG-COMPATIBILITY.md`, подтверждено на этом SHA заново, не по памяти r1.
- Job «Бэкенд: pytest в Home Assistant» зелёный **на точном SHA материала
  этого раунда** (сильнее, чем в r1, где сверялся только старый SHA).
- Трейлеры `026fa8e8`/`180b3026`/`b7a3aaba`/`a9ae4fde` — корректны (первые два
  разобраны в r1; последние два — докс-only ревью-артефакты с `Issue:#877`,
  `User-Visible: no`, без изменений changelog, что и требуется для docs-only).
- Числа, видимые пользователю: дифф раунда не добавляет новых — только
  регенерацию счётчиков индекса ревью (внутренний артефакт, не
  пользовательская величина).

## Чего не проверял

- Не прогонял `npx tsc --noEmit`, `npm test`, `npm run build` сам — Validate
  зелёный на точном SHA материала `a9ae4fde` (прогон 38454981478, указан в
  промпте раунда), фронтенд не тронут ни в r1, ни в дельте r2.
- Не прогонял полный `pytest tests_backend/` локально — в песочнице ревью нет
  `homeassistant`; вместо этого сверил `gh run view 38454981478` → job
  «Бэкенд: pytest в Home Assistant»: success на точном SHA этого раунда
  (сильнее замены, чем в r1).
- Не запускал мутанты реестра (трек show, #709) — только сверил имена
  гард-тестов с существующими функциями.
- Не запускал смоки/golden/invariants/performance — дифф не трогает рендер,
  геометрию, canvas, touch; джобы `Мутанты по диффу`, `Геометрия`, смоки,
  golden, performance в CI-прогоне материала — `skipped`, ожидаемо для этого
  диффа и трека.
- Не открывал реальный мастер HA в браузере — то же ограничение окружения,
  что в r1; pytest-харнесс на точном SHA — эквивалентное доказательство.

## Вердикт

Зелёный. Дельта раунда — ребейз на ушедший вперёд `dev` плюс механическая
регенерация `docs/reviews/INDEX.md`; код задачи не менялся (коммит `026fa8e8`
бит-в-бит тот же). Разбор проведён полным объёмом (ребейз на ушедший вперёд
`dev` — повод не ограничиваться доверием к r1), построчное сравнение
подтвердило идентичность, AC1–AC3 и защитные мутанты подтверждены исполнением
на точном SHA материала (строже, чем в r1). Риск по `store.py` (класс
`migration`) заново проверен и не меняет вывод — **route: fix**,
реклассификация не требуется.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/877-no-spaces-fresh-install`, коммит `a9ae4fde8ea6` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `25a6e0177a10b04ff2d25fb0027acba57037eb0c`
  ```
  git log --all --format='%H %T' | grep 25a6e0177a10
  ```
- Тело issue: `63a270980e39a03f43642be1b305c35af758367178386facd39ede0d1d15947c`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ3NDMsIm91dHB1dF90b2tlbnMiOjIwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0ODQzfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjozNCwib3V0cHV0X3Rva2VucyI6MTk1ODIsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6OTE4MjMsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoxMzAwODQ1LCJjb3N0VXNkRXN0aW1hdGUiOjAuODIzMzQ5MDAwMDAwMDAwMX1dLCJ0dXJucyI6MzQsImR1cmF0aW9uTXMiOjMyMzAzNSwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuODI4MTkyLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=4777 output_tokens=19602 cache_creation_input_tokens=91823 cache_read_input_tokens=1300845 num_turns=34 -->
