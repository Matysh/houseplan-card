# CODE-REVIEW — issue #1100, заход r1

Материал: `5bad7d01d5897e50875770fbca55ea2a2caedbc4` (ветка `issue/1100-geometry-history-restore`).
SPEC r2 GREEN подтверждён ([comment 6472008395](https://github.com/Matysh/houseplan-card/issues/1100#issuecomment-6472008395)), body SHA256 `b77babe0ad22cf5ccc0ce324bb6ffba7b98212df740a20ec2345f5580addac20` совпадает со снимком в REVIEW_CONTEXT.

## Скоуп

Три дорожки восстановления шага истории геометрии:
1. Снятие blanket-reset `_wallUnionCache = null` / `_physicalBodiesCache = null` в `_restoreGeometryStateLocal` — восстановленный этаж получает новый содержимое-ключ, чужие LRU-пулы (B/C) не трогаются.
2. Новая быстрая дорожка `restoreNonPhysicalHistory` (`src/decor-history-restore.ts`) для шагов подложки (`plan_transform`) и лестниц (`stairs`), когда `spacePhysicalGeometryFingerprint` не изменился и шаг не guarded — без `commitWallSegmentModel`/preflight/сброса union-тел.
3. Строгая физическая дорожка переведена на принятый общий helper #1099 (`physicalCandidateProof`/`commitEditedSpaceModel`/`adoptEditedSpaceModelInPlace`): raw-guard перед канонизацией, повторное использование вердикта только при равных `fingerprint+model_version` (≤1 union), иначе отдельная проверка канонизированного кандидата (≤2); отрицательный разрешённый `wall-degraded-extra`-вердикт остаётся отрицательным и не превращается в outbound proof.

Изменённые продуктовые файлы: `src/decor-history-restore.ts`, `src/houseplan-editor-runtime.ts`. Остальное — тесты, demo-smoke расширения, анализ, release-ledger, changelog, инвентарь.

## Как проверялось

Static-first: прочитан полный `read:diff` (все 32 изменённых файла), ключевые куски кода прочитаны в репозитории (`src/houseplan-editor-runtime.ts` `_restoreGeometryStateLocal`/`_applyGeometryState`, `src/decor-history-restore.ts`, принятый `src/physical-candidate-proof.ts` из #1099, `src/floor-geometry-key.ts` — ключевание и LRU-пулы в `houseplan-card.ts`). Прослежены вызывающие пути независимо от авторского описания, затем сопоставлены с хендоффом и `docs/analysis/1100-geometry-history-restoration.md`.

Выполненные проверки (помимо чтения):
- `read:diff`, `read:log` — полный диапазон диффа и лог коммитов материала.
- `build:test` — подготовка test-build (PASS, exit 0).
- `unit:test/geometry-history-restore.test.mjs` — **35/35 PASS**, включая счётчики union/preflight, пустых foreign-pool diff, pre-v9 с реальным unions:2 (неравный raw/canonical кандидат — видно в diagnostic-логе теста).
- `unit:test/decor-history-restore.test.mjs` — PASS (decor-only API не изменился; `restoreNonPhysicalHistory` — новые позитивные и ~15 негативных кейсов).
- `unit:test/geometry-history-refusal.test.mjs` — PASS, включая новый тест реального deferred-writer revalidation для F57 (`fingerprint=''` → при записи ещё одна строгая проверка, запись не уходит).
- `unit:test/wall-segment-model.test.mjs` — PASS (обновлённый source-pattern идентичности `commitEditedSpaceModel(restoredCandidate, target.spaceId)`).

Не перезапускались (переиспользована годная CI-evidence по неизменному материалу, см. `validate-gate` run [40747176241](https://github.com/Matysh/houseplan-card/actions/runs/40747176241)):
- Полный `npm run gate:small`/build/typecheck/bundle — покрыт product/tooling/docs CI на этом же SHA.
- Браузерные smoke (`smoke_floor_cache_reuse`, `smoke_backdrop`, `smoke_stairs`, `smoke_wall_chain_history`, `smoke_node_history_context`, `smoke_geometry_history_refusal`, `smoke_opening_drag`) и 4 строгих Golden-кадра — покрыты тем же run (38/38 smokes + 4/4 strict Golden, byte-identity PNG).
- `pytest tests_backend -k "wall_node or junction"` — backend-код не тронут (нет .py в диффе), 224 PASS/2381 deselected зафиксировано в том же GREEN-прогоне.
- Мутанты `*-1100` — не исполнялись (нет nightly-прогона в рамках ревью); они зарегистрированы статически и явно помечены в `docs/analysis/1100-geometry-history-restoration.md` как «registered, not executed» для AC1, AC3, AC4, AC5. Это соответствует общей политике (обычные negative-input тесты выше уже дают разрешённого свидетеля; мутация реализации для проверки «чем краснеет» не запускалась).

Дополнительный прогон сверх названного не требовался: ни один AC/риск/negative-case не остался без пригодного доказательства при независимом разборе кода.

## Независимый разбор критичных мест

- **Ключевание пулов** (`floor-geometry-key.ts`, не изменён в этом диффе): `_wallUnionPool`/`_physicalBodiesPool` — ограниченные LRU (`WALL_UNION_POOL_LIMIT=8`), записи по старому ключу восстановленного этажа не удаляются точечно (в отличие от «принято предположительно» в ТЗ, где упоминалось точечное удаление), но это не нарушает AC1: контракт требует сохранности ключей **других** этажей, а не удаления устаревшей записи своего этажа — она вытесняется обычным LRU. ТЗ явно разрешает менять это предположение при ревью.
- **`_cfgEpoch++` и глобальная память fingerprint** (`floorRecordKeyMemo`): инкремент эпохи очищает per-epoch memo для ВСЕХ этажей, но это дешёвая перекомпиляция content-fingerprint (~1.5мс/этаж, существующее поведение из #744/#769, не регрессия #1100), а не пересборка union — реального wall-union rebuild для B/C не происходит, что подтверждено тестом `physical Undo retains warm foreign floor pools` (строка 12: после переключения на `b` счётчик `_floorCacheBuilds.wallUnion` не меняется).
- **Счётчики ≤1/≤2 union** (`_applyGeometryState`): прослежена цепочка `rawProof = proof(restoredCandidate)` → `proof(committedCandidate, rawProof)`, которая внутри `physicalCandidateProof` (принят в #1099) возвращает `previous` без повторного прохода только при равных `fingerprint+modelVersion`; для `wall-degraded-extra` добавлена отдельная обёртка, сохраняющая отрицательный вердикт без промоушена в успех. Исполнение теста `exact raw/canonical union quota: pre-v9` живьём показало `equal:false, unions:2` для undo и `equal:true, unions:1` для redo — именно та асимметрия, которую описывает контракт п.2 AC3.
- **`restoreNonPhysicalHistory`**: использует тот же `restorableSpace` guard, что и decor-only (current model version, complete carriers, без `room_drafts`/`open_spans`/отсутствующих `wall_ids`), плюс валидацию `plan_transform` по белому списку ключей и типов `decor`/`stairs`. Это сужает быструю дорожку относительно буквальной формулировки «Контракта» (только fingerprint+not guarded), но данное сужение прямо разрешено как «принято предположительно, поменять свободно при ревью» и документировано в ARCHITECTURE.md/DEVELOPMENT.md/analysis.md; негативные тесты (`legacy`, `draft`, `mixed-catalogue`, `invalid-plan`, `unknown-plan-key` и др.) подтверждают, что сужение не открывает дыр, а только сохраняет строгую дорожку для редких legacy-случаев — не регрессия.
- **F57/outbound fingerprint**: `_pendingPhysicalWrites.set(... fingerprint: strict ? spacePhysicalGeometryFingerprint(afterSpace) : '')` — пустая строка при отрицательном repaired-вердикте гарантированно не совпадёт ни с одним реальным fingerprint на записи, вынуждая повторную строгую проверку в deferred writer; подтверждено живым тестом `a repairable negative boundary is revalidated by the real deferred writer and cannot send` (реальный `s.writes()`, `s.server.sets` не меняется).
- **AC7 / таблица «AC · чем доказан · чем краснеет»**: присутствует в `docs/analysis/1100-geometry-history-restoration.md` для всех семи AC, с указанием либо обычного negative-run (AC2 — провал контрольных «no_physical_builds» ассертов на неизменённой базе), либо id зарегистрированного witness с пометкой «registered, not executed» (AC1, AC3, AC4, AC5). Требование §2.7 выполнено.
- **Трейлеры `Issue:`/`User-Visible:`**: не было инструмента для чтения полных сообщений коммитов (доступен только `read:log` в формате oneline, без тела/трейлеров, Bash/git недоступны). CHANGELOG.md/CHANGELOG.ru.md присутствуют в changedFiles с идентичной однострочной записью (#1100) на русском и английском; штатный pre-push hook (enforced trailers) прошёл без обхода согласно хендоффу («GREEN 298с/0 failed», ни разу не упомянут `--no-verify`). Независимая побайтовая проверка текста трейлера терминального коммита не выполнена из-за отсутствия подходящего инструмента — честно фиксирую эту границу, а не выдаю её за «proверено».

## Находки

Находок уровня High/Medium в скоупе не обнаружено.

## Что проверено и корректно

- Отсутствие blanket-reset пулов чужих этажей (AC1) — живой unit-тест + анализ, пулы B/C не меняются.
- Быстрая дорожка подложки/лестниц без commit/preflight/union (AC2) — живой unit-тест (`modelReads=0`, `counts.preflight=0`, `counts.union=0`) + decor-only API не тронут (`restoreDecorOnlyHistory` по-прежнему возвращает `false` для stairs/transform — явный тест).
- Счётчики ≤1/≤2 union, порядок raw-перед-canonical, сохранение обеих ролей safety-check (AC3) — живой прогон с диагностикой по девяти физическим кейсам, включая pre-v9 с реальным расхождением.
- Отказы истории не изменились, F57 остаётся отрицательным и не становится outbound proof, повторная проверка в deferred writer (AC4) — живой unit-тест с реальным `s.writes()`.
- Decor-only lane не регрессировала, stairs/transform ушли в новую быструю дорожку, а не в strict (AC5) — явные тесты с обеими функциями на одном fixture.
- AC6: пары cold/warm, apply/inverse, 7 повторов, до/после — в `docs/analysis/1100-geometry-history-performance/*`, before 84/84 RED по счётчикам, candidate 0 нарушений; threshold не введён и не менялся.
- AC7: `pytest` backend-подмножество и общий `targeted/adjacent` набор — через переиспользуемую CI-evidence, backend-код не тронут.
- Golden: 4 строгих кадра byte-identical, никакой глобальной приёмки, ledger `stable-fix` с обоснованием со ссылкой на точный stable-коммит.
- Ресурсный бюджет (+1015 байт) и авторизованный владельцем сдвиг reference (issue comment 6476497110) задокументированы и не маскируют policy-метрику.

## Чего не проверял

- Побайтовое содержимое трейлеров `Issue:`/`User-Visible:` терминального коммита (инструмента для чтения полного тела коммита не было в рамках доступных read-check'ов).
- Повторное исполнение мутантов `*-1100` (вне ночного workflow, запрещено текущей политикой; статическая регистрация подтверждена чтением `scripts/mutation-registry.mjs`, find/replace-паттерны сверены с текущим кодом построчно).
- Полный браузерный прогон smoke/Golden и backend pytest заново — переиспользована валидная CI-evidence того же SHA (`review-light-golden proof is complete`), пересчёт не требовался, так как материал/входы/oracle не менялись.

## Маршрут

mode=issues по снимку политики; побочных находок нет, `outside_findings` пуст.

## Вердикт

GREEN. Реализация соответствует контракту ТЗ r2 (owner-подтверждённому решению по union-квоте), три дорожки корректно разделены, защитные AC задокументированы таблицей «чем доказан/чем краснеет», независимо перепрогнанные unit-тесты (35+15+N test, 0 fail) подтверждают ключевые счётчики вживую на реальном коде, а не на моках.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6ImUwMzM2Y2EzNjZkMDcxZjc2OTRiNTQ4YjhkN2RiNzA0YWYzM2Q4MTBkNGViMzE3ZmI5MzhiM2MyOTUzNDliYzgiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiIwY2IxNmJkNDgzZGM1OGMxOGQ1OGI0NTQ2MTIyNzA1ZDhlYTc0MGQzYTk5YmM3ZmE1NjAzYjFlMjgxZDFiNGQ4IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTAwLCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiI1YmFkN2QwMWQ1ODk3ZTUwODc1NzcwZmJjYTU1ZWEyYTJjYWVkYmM0IiwidHJlZSI6IjQ3MjQzNDI5NmVkNjVkZGM0OTE0MTkyYjQzMjhlOTcyOTdlYzRmNjgiLCJib2R5RGlnZXN0IjoiYjc3YmFiZTBhZDIyY2Y1Y2NjMGNlMzI0YmI2ZmZiYTdiOTgyMTJkZjc0MGEyMGVjMjM0NWY1NTgwYWRkYWMyMCIsInByb2R1Y2VyUnVuIjoiNDA3NDk0MDU3MTciLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6ImI4ZmUwYjBiNmM4YzRlM2FjMzU0NmI4YWJiNjZiNGY1ZGM4ZTczOTlmYWM1YjAxYWU4NDQwMDQ1ZjBjNTAxNzMiLCJ2ZXJkaWN0RGlnZXN0IjoiNzE4MTU5ZDlmY2E4MzI5Zjk3ZWJjMzg0OTcwNThhMDdmMDNiYTJhZDA5NGE4YjlhNjlhZDg0ZTc5ZTlkYjRmYSIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiIwNmJjNzJiNGNkNWI5Y2NiODMwZTdhYTdhMTkwOTBjMDY0YTMwZjU0MzU3M2FlZDNlNzRhOTllNWM3MmNhODQwIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDc4MTYxOTM0LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTAwI2lzc3VlY29tbWVudC02NDc4MTYxOTM0IiwiYm9keURpZ2VzdCI6ImQ1ZmIwMmI4M2JmYTg0NTM3MThlNzllOTM4NDQ0MWJkNTVmYjEwMTgxZDM2MWQ3YjcwZGY1NDNmN2M3ZjQyYTYifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1100-geometry-history-restore`, коммит `5bad7d01d589` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `472434296ed65ddc4914192b4328e97297ec4f68`
  ```
  git log --all --format='%H %T' | grep 472434296ed6
  ```
- Тело issue: `b77babe0ad22cf5ccc0ce324bb6ffba7b98212df740a20ec2345f5580addac20`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40749405717,"run_attempt":1,"digest":"927fa3340a71a63ea0d7ed8e6b5f2a6d7366bfd55a31d3c0156c364d1bf12ef0"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6OTAsIm91dHB1dF90b2tlbnMiOjM0MDk4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE2ODk0MiwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjQ1MTE0NjksImNvc3RVc2RFc3RpbWF0ZSI6MS45MTkyMjE3OTk5OTk5OTk2fV0sInR1cm5zIjo1MiwiZHVyYXRpb25NcyI6NDQ0MzI3LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS45MTkyMjE3OTk5OTk5OTk2LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=90 output_tokens=34098 cache_creation_input_tokens=168942 cache_read_input_tokens=4511469 num_turns=52 -->
