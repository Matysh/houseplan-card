# CODE-REVIEW — issue #1107, заход r1

Материал: `2f8073034c042c9b0a8dda23979b32e0b1998270` (tree `30c706f70a…`), трек `show`, этап `code`.
Тело issue (bodyDigest `e9be46f5e3f0…`): предзаписанная находка из ревью #1000 (код, r1, материал `280357238ce6…`) — в `docs/CHANGELOG.md` строки 15–16 и `docs/CHANGELOG.ru.md` строки 22–23 базовой (dev `ec9f6c60b`) версии уже содержали два соседних почти-дублирующих пункта (#1087); более полный пункт включает локализованные ошибки выбора. Задача #1107 заведена ровно для устранения этого дубля, вне скоупа #1000.

## Скоуп

Изменённые файлы (per REVIEW_CONTEXT.changedFiles, static-first):

- `docs/CHANGELOG.md`
- `docs/CHANGELOG.ru.md`
- `docs/release-ledger/v1.82.0/1107.json` (новый)
- `scripts/ci-registry-inventory.json` (сгенерированный)

Диапазон коммитов (`read:log`, PASS): `7453104e6` → `4a439eed1` → `e3b8ae2d2` → `2f8073034` (4 коммита поверх базы `ec9f6c60b`, которая является общей точкой с текущим `origin/dev`; dev ушёл на 22 коммита вперёд собственной веткой, конфликтов при слиянии нет — ожидаемо для трека `show`, #696).

`read:diff` (PASS) возвращает полный двухточечный diff `origin/dev..HEAD`; поскольку dev за это время получил несвязанные коммиты (в т.ч. #1000 — `marker_alerts.py`, `src/editors/marker-alerts.ts` и т.п., показанные как удаления), эти хунки — шум расхождения веток, а не материал ревью. Я их не разбирал по существу и опираюсь на `changedFiles` из REVIEW_CONTEXT как на границу материала; в самом diff явно видны именно ожидаемые 4 файла (строки 496–533, 6676–6692, 7194+).

## Как проверялось

Независимо прочитан итоговый контент всех 4 файлов и точные diff-хунки:

1. **docs/CHANGELOG.md / docs/CHANGELOG.ru.md** — diff показывает удаление ровно короткого дубля #1087 в каждом языке (EN: `...with localized selection errors.` отсутствует в удалённой строке и присутствует в оставшейся; RU: аналогично `ошибки выбора поясняются на языке интерфейса` есть только в оставшейся строке). Короткая версия — строгое префиксное подмножество текста полной версии, потеря информации исключена. `grep '1087'` по итоговым файлам подтверждает ровно один пункт на язык (docs/CHANGELOG.md:15, docs/CHANGELOG.ru.md:22). Пустых двойных строк/артефактов форматирования вокруг среза не осталось (прочитан итоговый файл целиком в районе правки).
2. **docs/release-ledger/v1.82.0/1107.json** — новый файл, схема 1, `category: "infra"`, rationale описывает ровно diff (удаление дубля + генератор inventory), summary на двух языках. Классификация `infra` соответствует тому, что раздел затрагивает только документацию/генерируемый CI-инвентарь, рантайм продукта не меняется — соответствует духу #838 (инфраструктурные правки не входят в пользовательский milestone). Это авторское суждение, я не нашёл оснований ему возражать.
3. **scripts/ci-registry-inventory.json** — diff добавляет `"docs/release-ledger/v1.82.0/1107.json"` ровно в двух списках (`frontend`/`backend` job inputs, строки 2434 и 3531 итогового файла) алфавитно на своём месте; никаких других правок файла нет.
4. Запущены адресные исполнимые oracle из манифеста (всё `executed:true`, `status:"passed"`, PASS — это обычные unit-тесты/статическая проверка на материале, не мутанты):
   - `static:ci-registry-inventory` — PASS (генератор согласован с содержимым файла).
   - `unit:test/ci-registry-inputs.test.mjs` — PASS (соответствует заявленным в хендоффе 22/22).
   - `unit:test/release-ledger.test.mjs` — PASS (схема/категория ledger-файла для #1107 валидны).
   - `unit:test/user-stable-changelog.test.mjs` — PASS (контракт changelog не нарушен).

Эти 4 чека покрывают весь исполняемый риск этого диффа (генератор inventory + ledger-схема + changelog-контракт); дополнительных build/typecheck/smoke не потребовалось — изменения не касаются рантайм-кода, TS-источников или UI, а `build:*`/`smoke:*` не являются «запасным сценарием ревью» по политике.

CI-доказательство из handoff (`ciEvidence`, validate-gate run 40595751380, "review-light proof is complete") принято как пройденные проверки сборки/бюджета, не переисполнялось.

## Находки

Находок нет. Диапазон изменений строго соответствует заявленному AC («один полный пункт #1087 на язык, вне скоупа #1000»), подтверждён независимым чтением diff и итогового контента, а не только хендоффом.

## Защитный AC

Правка не вводит валидацию/гард/лимит/отказ/инвариант — это детерминированная текстовая дедупликация и регистрация статического пути в сгенерированном инвентаре. Таблица «AC · чем доказан · чем краснеет» не требуется (не защитный AC); доказательство — чтение итогового diff + прогон генератора/unit-тестов, перечисленных выше.

## Трейлеры и релизный учёт

- `docs/release-ledger/v1.82.0/1107.json` зарегистрирован и проходит `unit:test/release-ledger.test.mjs`; категория `infra` обоснована в rationale.
- Видимое пользователю поведение не меняется (чисто документационная дедупликация + генерируемый CI-артефакт) — `User-Visible: нет` ожидаемо корректен; нет величины, которая отображалась бы дважды с разными источниками (§8 неприменим).
- Полный текст commit trailers (Issue/User-Visible) не доступен через разрешённый read-only набор инструментов (нет shell/`git show`, только `read:log --oneline` и `read:diff`); это предел доступного evidence, прямо проговариваю. Механический гейт ledger (`readMergeEntry`) по хендоффу уже проверял delivery-членство на этом материале и дважды возвращал задачу до вызова модели (`ledger: #1107: only SPEC delivery exists…`, `stale doc-only classification…») — оба раза именно из-за rationale/категории ledger, а не из-за отсутствия trailers; итоговый `unit:test/release-ledger.test.mjs` PASS на данном материале подтверждает, что ledger-файл сейчас соответствует контракту.

## Что проверено и корректно

- Дедупликация #1087 в обоих changelog — точная, без потери информации, без побочных правок соседних пунктов.
- Новый release-ledger файл для #1107 — валиден по схеме и по rationale.
- Регенерированный `scripts/ci-registry-inventory.json` — содержит ровно ожидаемые две новые ссылки на `docs/release-ledger/v1.82.0/1107.json`, без посторонних изменений.
- Критерии трека `show`/маршрута (§5, #726): сложность ≤3, одна поверхность (документация релиза), нет миграции конфига, нет нового UX-контракта, нет влияния на производительность/touch, ожидаемое поведение — это просто устранение дубля текста, уже существовавшего в базе dev. Все условия выполнены.

## Чего не проверял

- Весь остальной шум diff `origin/dev..HEAD`, не входящий в `changedFiles` (файлы #1000 и прочих задач, независимые от #1107) — вне материала этого ревью.
- Полные тела commit-сообщений (Issue/User-Visible трейлеры) — недоступны через разрешённый read-only набор; опирался на прошедший `unit:test/release-ledger.test.mjs` и CI-доказательство validate-gate как на подтверждение, что механический ledger-гейт для #1107 сейчас зелёный.
- Полные `build`/`typecheck`/browser-smoke наборы — не являются запасным сценарием ревью и не относятся к риску этого чисто документационного диффа; тело issue не называет смоук.

## Гейты: что прогнано и почему

Прогнано (адресно под конкретный риск диффа):
- `read:log`, `read:diff` — PASS, определение границ материала.
- `static:ci-registry-inventory` — PASS, статическая сверка генератора с файлом.
- `unit:test/ci-registry-inputs.test.mjs` — PASS, инварианты inventory.
- `unit:test/release-ledger.test.mjs` — PASS, схема/категория ledger-файла #1107.
- `unit:test/user-stable-changelog.test.mjs` — PASS, контракт changelog.

Не прогонялось (и почему не нужно):
- `build:*`, `typecheck`, `bundle:sync` — диапазон не трогает TS-исходники/сборку; принятое CI-доказательство validate-gate (run 40595751380) уже покрывает обычную сборку/бюджет для этого материала.
- `smoke:*` (browser) — тело issue не называет смоук (#696), правка не затрагивает UI/рантайм.
- Полный `gate:small`/golden/pytest — не являются запасным сценарием ревью; непокрытого риска, который бы их потребовал, не выявлено.

## Маршрут

`route: fix`. Все критерии §5 (#726) выполнены: сложность ≤3, одна поверхность, нет миграции, нет нового UX-контракта, нет влияния на производительность/touch, поведение не ново (устранение уже существовавшего в базе дубля текста).

## Вердикт

**green**. High: 0, Medium: 0. Побочных находок вне скоупа в этом раунде нет — ранее зафиксированная находка (дубль #1087, источник #1000 code r1) устранена именно этим материалом.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjMwZDVmNjdhNTNkMGM3Y2Q5NTdmMmI0NDhmYWIxMzRiZTFlMGJhNGRiNmI3ZjkxYzkzYTRlYTE3MzY0MjYxYzEiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI4MWRmNmEzZTE0ZmY4ODcyZDZjMGEwNGE5MzEzZmQzNzA1ODhiMjFjNzFmYTg2M2RlMWNhYzZkMDBlNmY4YWYwIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTA3LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiIyZjgwNzMwMzRjMDQyYzliMGE4ZGRhMjM5NzliMzJlMGIxOTk4MjcwIiwidHJlZSI6IjMwYzcwNmY3MGEyODk2ZDZjZTYyNGNhMTZjNTA0ZmIzYzllZDljYmQiLCJib2R5RGlnZXN0IjoiZTliZTQ2ZjVlM2YwZjg0ZmEzN2VmMzQ1ZTRmNzI3NDgzYmIxOTdiMGJmMmNhMDIzNzI0ODk3OTI2ZjVjMjdlNyIsInByb2R1Y2VyUnVuIjoiNDA1OTY1ODc0MTUiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjRjMjgzNzk1NWJhODk5MTkwNTcyNDkyYTgxMGI4ZGVjZTAyYjJlMGI3YTY2OTUyYWNiN2RmZjAxM2RhM2U2MjciLCJ2ZXJkaWN0RGlnZXN0IjoiMDEwNmM5NDZhNDZmM2Q2ODZhNjFjZjQxYzcxOGMzNmMwOTk5ZTZkYWNiODM5NGVjYTdjYWFmYTRkNTQzNmUxYiIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI0M2M0NDg2ZjU4NjgzNWU3MTM3YjNkOGZkZTgwNTQ4MmI3ZWZmZTMxN2M3ZTVjZGIzNjJkMDQ4ZDE3ZmQ0MzhlIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDU1NDg1MDYxLCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTA3I2lzc3VlY29tbWVudC02NDU1NDg1MDYxIiwiYm9keURpZ2VzdCI6ImJmNjE1Y2U3ZTk0MTk0MThjMzFhYTE3YjJkMTcxZDkyMDcxOGMwM2FlYmZkNWVmNzRiNzkyYTVlY2NkM2E1MGIifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1107-changelog-1087-dedup`, коммит `2f8073034c04` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `30c706f70a2896d6ce624ca16c504fb3c9ed9cbd`
  ```
  git log --all --format='%H %T' | grep 30c706f70a28
  ```
- Тело issue: `e9be46f5e3f0f84fa37ef345e4f727483bb197b0bf2ca023724897926f5c27e7`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40596587415,"run_attempt":1,"digest":"2b4c90068e710ecefee0f5a7025a5d46d445ea6710118777fb9df7c96208d188"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NDAsIm91dHB1dF90b2tlbnMiOjE3MDEwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEwMzgxMCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjE3MTAzMDQsImNvc3RVc2RFc3RpbWF0ZSI6MC45Mjc0ODA3OTk5OTk5OTk4fV0sInR1cm5zIjozMywiZHVyYXRpb25NcyI6MjcyOTYzLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MC45Mjc0ODA3OTk5OTk5OTk4LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=40 output_tokens=17010 cache_creation_input_tokens=103810 cache_read_input_tokens=1710304 num_turns=33 -->
