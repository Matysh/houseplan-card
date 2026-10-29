# CODE-REVIEW — issue #1125 (заход r2)

**Материал:** `8d4ad091371bb73f86cdeb4ba63ded5384be752b` (дерево `fba5ce805b55af25ec47f0610655a099e2b3b86e`)
**База задачи:** `32cdf439a6cc03eb0f354c2eec63972a60b8d912` (принятая `#1120`)
**Трек:** show · **Этап:** code · **Цикл:** заход r2, блокирующих циклов 1/2

## Скоуп

Заход r2 устраняет единственный Medium из r1
(https://github.com/Matysh/houseplan-card/issues/1125#issuecomment-6499734812):
`docs/release-ledger/v1.82.0/1125.json` классифицировал пользовательский
багфикс как `infra`. Текущий коммит `8d4ad0913` меняет только `category` на
`stable-fix`, переписывает `rationale` и добавляет обязательные
`summary.ru`/`summary.en`; синхронизирован `docs/reviews/INDEX.md`
(счётчики документов/issue конвейера).

Изменения ровно в двух файлах после публикации r1 (`51a49b5a4`):
`docs/release-ledger/v1.82.0/1125.json`, `docs/reviews/INDEX.md`. Это
подтверждено `read:diff` (полный диапазон база→кандидат): файл-ledger
появляется как `new file` сразу с финальным содержимым (`category:
"stable-fix"`), и `CODE-REVIEW-1125-r1.md` присутствует в том же диффе
байт-в-байт тем же содержимым, что я независимо прочитал из рабочего
дерева — запечатанный документ r1 не редактировался. Никаких изменений
рантайма, компилятора, тестов, guard'ов, схемы, API или UX — класс
изменения этого раунда чисто C (release accounting).

## Как проверялось

Static-first: повторно прочитан `docs/release-ledger/v1.82.0/1125.json`,
`docs/reviews/CODE-REVIEW-1125-r1.md`, `docs/reviews/INDEX.md`,
`docs/release-ledger/cycle.json`, соседние записи `#1120` (stable-fix,
с `summary`) и `#1121` (infra, без `summary`) — для сверки формы схемы.
Прочитан `scripts/release-ledger.mjs` (`validateEntry`,
`isUserReleaseEntry`): `stable-fix` входит в `isUserReleaseEntry`, поэтому
требует непустых `summary.ru`/`summary.en` — оба присутствуют; `introducedBy`
обязателен только для `line-fix`, для `stable-fix` не требуется и
отсутствует — корректно. `baseStable: "v1.82.0"` совпадает с
`docs/release-ledger/cycle.json` (`baseStable: v1.82.0`, `targetStable:
v1.83.0`, milestone 9) — запись не устарела относительно текущего цикла.

Выполнен `read:log` (7 коммитов диапазона, самый ранний `839fc815a` — сам
B-фикс, затем доки/ledger/review, последний `8d4ad0913` — предмет r2) и
`read:diff` (полный диапазон база→кандидат, 49 349 Б) — подтверждают, что
единственная содержательная правка после r1 находится в ledger-записи и
индексе ревью; всё остальное (barrier в `scripts/bundle-manifest.mjs`,
10 новых тестов `test/bundle-assets.test.mjs`, anchors
`scripts/mutation-registry.mjs`, baseline/inventory, `docs/ARCHITECTURE.md`,
оба `CHANGELOG`) идентично тому, что уже независимо разобрано и проверено в
r1 — повторный построчный разбор `waitForHaBootstrap` не требуется (вход,
среда и oracle не изменились).

### Выполненные проверки (fixed-check runner)

| Check | Результат |
|---|---|
| `read:diff`, `read:log` | прочитано (полный диапазон база→`8d4ad0913`, 7 коммитов) |
| `unit:test/release-ledger.test.mjs` | **6/6 PASS** — включая «missing, stale and unjustified classifications cannot be guessed» и «milestone writes are idempotent, excluded categories remove only the release milestone»: схема `1125.json` (schema/issue/baseStable/category/rationale/summary для user-release категории) валидна на этом материале |
| `unit:test/reviews-index.test.mjs` | PASS (генератор индекса не расходится с `docs/reviews/INDEX.md`) |
| `unit:test/process-gate.test.mjs` | PASS |

### Переиспользованное доказательство (не повторялось)

Весь B-фикс (`waitForHaBootstrap`, барьер в обоих entry-фасадах, 10 новых
тестов, мутационные якоря, байтовая сборка) и его доказательства —
real-HA негатив `40865674089` (3 setup PASS / 4 transfer FAIL, идентичный
`HpDialog Illegal constructor`), real-HA позитив `40872299778` (7/7 PASS,
точный `fd95d11f7`), `test/bundle-assets.test.mjs` 54/54 PASS,
`static:mutation-registry`/`static:bundle-budget`/`static:ci-registry-inventory`,
обычный protected push `GREEN 261s` и validate-gate `61b0f2299`
(https://github.com/Matysh/houseplan-card/actions/runs/40890637671, «review-light
proof is complete») — всё это независимо проверено в
`docs/reviews/CODE-REVIEW-1125-r1.md` и не меняется этим раундом: ни код,
ни тесты, ни их входы/среда/oracle не менялись между r1 и r2 (подтверждено
`read:diff` выше — правка только в ledger/INDEX). Повторный прогон этих
гейтов не даёт нового сигнала и не требуется правилом «изменение входа
требует нового доказательства» (#857).

Дополнительный validate-gate материала `8d4ad091`
(https://github.com/Matysh/houseplan-card/actions/runs/40897213958, «review-light
proof is complete») также зелёный и подтверждает совместимость обязательных
гейтов на этом SHA.

### Не прогонялось и почему

- Полный real-HA e2e на финальном beta-кандидате — отдельный пререлизный
  гейт (не гейт этого ревью), как и в r1.
- Demo-смоки диалога (`smoke_esc_dialogs.mjs` и др.) — не перезапускались;
  C-only правка не трогает рантайм/UI, переиспользуется зелёное
  доказательство r1 на том же байт-идентичном `527fc27…`.
- Полный `test/bundle-assets.test.mjs` (54/54) — не перезапускался в этом
  раунде: код/тесты не менялись с r1, где этот набор уже лично прогнан
  после `build:build`.

## Независимый разбор правки

`docs/release-ledger/v1.82.0/1125.json`:
- `category: "stable-fix"` — соответствует `PROCESS.md` §11.9: дефект
  (`Illegal constructor`/отсутствие модальной оболочки) ломал поведение,
  уже существовавшее в stable `v1.82.0` (HpDialog и стабильные
  entry-фасады существовали до этой задачи — сам диф этого раунда их не
  создаёт, лишь добавляет барьер поверх), а правка его восстанавливает.
  Это ровно устраняет находку r1: класс изменения B/C (где лежит код
  фикса) не определяет пользовательскую категорию — что было
  единственной ошибкой предыдущей классификации.
- `rationale` переписан в терминах пользовательского поведения («Settings
  and import forms… modal shell… restore that existing user-visible
  behavior»), а не механизма сборки — соответствует требованию находки.
- `summary.ru`/`summary.en` присутствуют и совпадают по смыслу с записями
  `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` (неизменными с r1).
- Схема валидна: `validateEntry` (`scripts/release-ledger.mjs:26-37`)
  требует непустых `summary.ru/en` для `isUserReleaseEntry` (`major`/
  `stable-fix`) — выполнено; `introducedBy` требуется только для
  `line-fix` — корректно отсутствует.

`docs/reviews/INDEX.md`: счётчик документов/issue инкрементирован
(232→233, 111→112); строка `#1125 · CODE-REVIEW-1125-r1.md · r1 · 🟡` не
редактировалась — это корректно: индекс фиксирует исторический снимок
r1, новую строку r2 добавит конвейер при публикации этого документа.

Дефектов в правке не найдено.

## AC · чем доказан · чем краснеет

AC1–AC3 из тела issue относятся к самому B-фиксу (`waitForHaBootstrap`) и
уже разобраны и доказаны в r1 — таблица «AC · чем доказан · чем краснеет»
`docs/reviews/CODE-REVIEW-1125-r1.md` (раздел того же названия) остаётся в
силе без изменений, так как код/тесты не менялись. Предмет этого раунда —
не AC из тела issue, а единственная находка r1 (release-ledger категория);
она не описывает защитный путь продукта, поэтому строка
«AC · чем краснеет» к ней неприменима.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| Medium — `docs/release-ledger/v1.82.0/1125.json` классифицирует пользовательский багфикс как `infra` вместо `stable-fix` | `category` изменён на `stable-fix`, `rationale` переписан в терминах восстановленного пользовательского поведения, добавлены обязательные `summary.ru`/`summary.en` | `docs/release-ledger/v1.82.0/1125.json` (коммит `8d4ad0913`); `unit:test/release-ledger.test.mjs` 6/6 PASS подтверждает валидность схемы на этом материале |

## Унаследовано из r1

Без повторной проверки принято из `docs/reviews/CODE-REVIEW-1125-r1.md`
(материал `61b0f22994394c7c8c58c78da1c57d4ae9d5036b`, т.к. код/тесты/их
входы и среда не изменились между r1 и r2 — подтверждено `read:diff`):

- Независимый разбор `waitForHaBootstrap` и его встраивания в оба
  entry-фасада (барьер вне `try/catch`, два ранних `return` для не-HA и
  прогретого HA, повторная проверка владения текущим реестром после
  `whenDefined`) — дефектов не найдено.
- `test/bundle-assets.test.mjs` 54/54 PASS, включая 10 новых bootstrap-
  тестов и мутационные якоря `#486`/`#1018`.
- `static:mutation-registry`, `static:bundle-budget`,
  `static:ci-registry-inventory`, `unit:test/monolith-metrics.test.mjs`,
  `unit:test/node-input-ledger.test.mjs`, `unit:test/ci-profiles.test.mjs`
  — все PASS.
- Real-HA негативный свидетель `40865674089` (причинная гонка на
  неизменённом `775`) и позитивный `40872299778` (точный `fd95d11f7`,
  7/7 PASS) — зарегистрированные свидетели, разобраны в r1.
- Байтовое тождество рантайма/компилятора между `fd95d11f7` и
  последующими doc/ledger-коммитами (75 runtime + 539 compiler файлов).
- `docs/ARCHITECTURE.md` точно описывает реализованное поведение.
- User-Visible: оба `CHANGELOG`/`CHANGELOG.ru.md` правлены согласованно.

## Чего не проверял

- Полный real-HA прогон на финальном beta-кандидате — отдельный
  пререлизный гейт, не гейт этого ревью (так же, как в r1).
- Demo-смоки диалога не перезапускались в r2 — переиспользовано зелёное
  доказательство r1, так как C-only правка не меняет рантайм/UI.
- Разбор самого B-фикса не повторялся построчно — переиспользован
  независимый разбор r1, так как код между раундами байт-в-байт не
  изменился.

## Вердикт

**Зелёный.** High: 0, Medium: 0. Маршрут: `fix` (критерии §5 проходятся:
сложность/риск ограничены ledger-записью одного issue, одна поверхность
— release accounting, нет миграции/конфига, нет нового UX-контракта, нет
влияния на perf/touch, ожидаемое поведение зафиксировано в теле issue и
`docs/ARCHITECTURE.md` с r1). Единственная находка r1 закрыта корректно и
полностью; новых находок в делте r2 не обнаружено. Побочных находок нет.

Маршрут публикации: `mode=issues` (сверено с
`REVIEW_FINDINGS_POLICY.json`, round 2) — в этом раунде он не
используется, так как побочных находок вне скоупа нет; `outside_findings`
пуст.

### Прогнанные/не прогнанные гейты (сводка)

Прогнано в этом раунде: `read:diff`, `read:log`,
`unit:test/release-ledger.test.mjs` (6/6), `unit:test/reviews-index.test.mjs`,
`unit:test/process-gate.test.mjs`. Переиспользовано без повторного
исполнения (материал/входы не менялись с r1): `build:build`,
`test/bundle-assets.test.mjs` (54/54), `static:mutation-registry`,
`static:bundle-budget`, `static:ci-registry-inventory`,
`unit:test/monolith-metrics.test.mjs`, `unit:test/node-input-ledger.test.mjs`,
`unit:test/ci-profiles.test.mjs`, demo-смоки диалога, оба real-HA прогона
(`40865674089` негатив, `40872299778` позитив), validate-gate `61b0f2299`
и `8d4ad0913`. Не прогонялось и не требуется этим раундом: полный real-HA
e2e на финальном beta-кандидате (отдельный пререлизный гейт), `pytest`/
`npm run invariants` (нет Python/геометрии в диффе), полные `gate:small`/
ночные наборы (несоразмерны C-only правке, §8).

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6ImIxN2E1MmE4YmEwOGMwODFmMjcyZGVhNWVhY2RmMzBiNDg2MjgyYjdiNzgxMWMwYjk1MmIyMTkwZGRhYWQxMjEiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI3NGEyYjMyOGM2ZmE4OWEyMzAzOTVhYTNhNDcyNjk4NDY0OTZlNWUzMTdlYTg3OWRjOWYwYmE0MWMwZTVlNDY0IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTI1LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MiwibWF0ZXJpYWwiOiI4ZDRhZDA5MTM3MWJiNzNmODZjZGViNGJhNjNkZWQ1Mzg0YmU3NTJiIiwidHJlZSI6ImZiYTVjZTgwNWI1NWFmMjVlYzQ3ZjA2MTA2NTVhMDk5ZTJiM2I4NmUiLCJib2R5RGlnZXN0IjoiYjJhNDM2ZGUzNGZkZDcwNGJjYTVhMDQ5OWVlOGI5YjczZGYxNDM3MWJkYmFlYTY2NDBiYmQ0ZDBjYTQ4ZDU4NSIsInByb2R1Y2VyUnVuIjoiNDA4OTgwMTU5MzYiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjZiY2JiY2RjZDY2NWM2YjFkZTlmNDVkZWU4MjQ2Njc5MTkwNGVkYmFiYWRlYTYwNjc5NDUyZmE3YWZmZDZlODQiLCJ2ZXJkaWN0RGlnZXN0IjoiZTQzMTBiYzU3Nzg1YzI5OWNiZjU0MzVlNTJiN2UzNWM4ZGY0YWUzOTJmNTYxYTRjN2RmN2NkM2VhY2JkNjFjYiIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJkM2U1Mzc3MmEzNTM4NjdlMDNkOTcyNDc5ZjllYTc0NGVkNjc5ZWIxMzZjZjdlMWE0MzA5NWM0ZDAwMzNjYTcwIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NTAwNTMxMDk4LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTI1I2lzc3VlY29tbWVudC02NTAwNTMxMDk4IiwiYm9keURpZ2VzdCI6IjUwMDUzYTdkOTIwZGM3MTIzYWJjZDllZDI5MTVkNjA1Y2ViNjhiZmNjNDM2MTY2ZDhjMTk3YWY1N2Y4MzRjYWQifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1125-ha-bootstrap-order`, коммит `8d4ad091371b` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `fba5ce805b55af25ec47f0610655a099e2b3b86e`
  ```
  git log --all --format='%H %T' | grep fba5ce805b55
  ```
- Тело issue: `b2a436de34fdd704bca5a0499ee8b9b73df14371bdbaea6640bbd4d0ca48d585`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NTQsIm91dHB1dF90b2tlbnMiOjE2Njc4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjExOTM0MCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjIzOTAzMjYsImNvc3RVc2RFc3RpbWF0ZSI6MS4xMjIzMTMyfV0sInR1cm5zIjozNiwiZHVyYXRpb25NcyI6MjI1NzU5LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS4xMjIzMTMyLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=54 output_tokens=16678 cache_creation_input_tokens=119340 cache_read_input_tokens=2390326 num_turns=36 -->
