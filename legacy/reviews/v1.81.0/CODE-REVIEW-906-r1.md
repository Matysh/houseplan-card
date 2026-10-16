# CODE-REVIEW-906-r1

Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0

## Материал

- Ветка `issue/906-zigbee-mapping-reuse`, HEAD `0a029feaa9d76575873c9d37b0c153b2a02d9247`,
  merge-base/accepted `dev` `facf77a16f78676af5e44442fc8eeb6fe4765d1c`. Рабочая копия подтверждена
  на этом SHA (`git rev-parse HEAD`). Диапазон `origin/dev..HEAD` — 5 коммитов,
  13 изменённых файлов, +422/-11.
- Трек `ask` (прямое поручение владельца от 2026-10-15, подтверждено строкой
  "Трек: ask — решение владельца" в контексте задачи). SPEC-REVIEW-906-r1 —
  зелёный, цикл не потрачен. Это первый код-ревью этого этапа (все
  промежуточные возвраты в S6 были техническими — merge conflict дважды,
  один красный Validate до модели — ни разу код не читался, циклы не
  расходовались).

## Скоуп

Issue #906 закрывает J7 ("Is my Zigbee mesh healthy here?", `docs/SCOPE.md`) —
не новая функциональность, а устранение лишней работы существующей Zigbee-
диагностики View/admin-only оверлея. `haRegistrySnapshot` возвращал новый
wrapper-объект при неизменных devices/entities/revision; оверлей инвалидировал
memo маппинга по identity этого wrapper и для provider-узлов без прямого
`deviceId` повторял линейный скан реестра на каждый несвязанный тик состояния
HA. Исправление — семантический ключ памятки вместо identity снимка.

## Как проверялось

Дешёвые гейты уже подтверждены зелёным Validate на этом SHA
(https://github.com/Matysh/houseplan-card/actions/runs/38782353938). Проверено
документально и независимо:

| Гейт | Статус | Как подтверждено |
| --- | --- | --- |
| Validate (CI), весь материал | GREEN | `gh run view 38782353938` → conclusion success, headSha совпадает с материалом. attempt1 (18:02–18:24) был RED из-за одного флакового булева в `smoke_sections_resize.mjs` (shard 3/3, несвязанный с диффом файл сайзинга секций); golden и perf в attempt1 PASS. Разрешённый единственный полный re-run того же workflow (attempt2, 18:32–18:50) дал SUCCESS по всем 3 browser-шардам; golden/perf в attempt2 помечены SKIPPED — это штатное переиспользование уже полученного PASS на том же дереве (`validate.yml` job "Переиспользование: это дерево уже проверено", #827), а не отсутствие доказательства. |
| `npx tsc -p tsconfig.test.json` | PASS | прогнан мной лично, exit 0 |
| `npm run build` | PASS | прогнан мной лично, rollup создал `dist`, exit 0 |
| `npm test` (полный) | PASS | прогнан мной лично: 4998 passed / 0 failed / 1 skipped, exit 0 |
| `node --test test/zigbee-mapping-memo.test.mjs` | PASS | прогнан мной лично: 22/22, включая AC1-свидетеля — вывод `{"initialScans":4,"repeatedScans":0,"nodeCount":2,"exactMapping":true}`, точное совпадение с заявленным автором |
| `node scripts/mutation-gate.mjs --check` | PASS | прогнан мной лично: definitions=1610 (включая 3 новые для #906), execution=0, caught=unknown (nightly only), 5 ранее известных warnings — совпадает с заявленным |
| `node scripts/process-gate.mjs --issues --report` | PASS | прогнан мной лично: 5 коммитов, 0 предупреждений |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 7 строк (3 прямых + 4 зарегистрированных) | прогнан мной лично — состав совпадает 1:1 с 7 смоками, которые автор привёл с raw/exit в evidence-906/ordinary.md и которые целиком покрыты зелёными browser-шардами Validate |
| Native browser smokes (сами файлы) | не переисполнял локально | `demo.local` не резолвится в этой песочнице (нет записи в `/etc/hosts`) — окружение не поддерживает демо-харнесс здесь; эти же 7 строк уже реально выполнены и PASS внутри зелёного Validate на точном SHA, повторный локальный прогон не обязателен |
| `npm run invariants` | не прогонял | диапазон не трогает геометрию модели/данные комнат — `mapTopologies` как чистая функция не менялась, меняется только то, когда вызывается её результат (identity ключа памятки) |
| `pytest tests_backend` | не прогонял | диапазон не содержит Python |
| `golden:verify` | не прогонял отдельно | метка `ci:golden` стоит из-за изменённых render-строк `hp-zigbee-topology-overlay.ts`; golden уже выполнен и PASS внутри зелёного Validate (attempt1, сохранено по дереву в attempt2) — повторный отдельный прогон дублировал бы уже учтённое доказательство |

## AC и защитные находки

| AC | Чем доказан | Чем краснеет |
| --- | --- | --- |
| AC1 | `test/zigbee-mapping-memo.test.mjs:51-77` — компилированный рендер оверлея с provider-узлами без `deviceId`; Proxy считает реальные обращения к реестру. Я лично воспроизвёл: `initialScans=4` (первый рендер — реальный обход), `repeatedScans=0` после несвязанного обновления `hass`/нового wrapper `registry`, identity результата (`mapped === first`) сохранена, включая post-render `updated()`. | Зарегистрированный мутант `zigbee-mapping-discards-semantic-reuse` (делает быстрый путь памятки недостижимым константой `previous.mapped.length < 0`) — id зарегистрирован, не исполнялся (политика #905/#709). Автор отдельно привёл ordinary baseline на неизменном исходном коммите `eda7fabd` тем же тестом: `initial=4/repeated=4` (красный по `4 !== 0`) — это обычный negative case на неизменной реализации, не исполнение мутанта. |
| AC2 | `test/zigbee-mapping-memo.test.mjs:85-183` — 17 кейсов инвалидации (revision0 device/entity rows, пустые rows, revision/authority/access/freshness/error, marker binding/visibility/permission/floor, provider material/revision, connection owner, user identity, admin permission) плюс A→B→A, scalar-capture и entity-only discovery. Каждый инвалидированный результат сверяется `assert.deepEqual(..., mapTopologies(...))` — не только identity, а точная геометрия. Я лично прогнал все 22 теста — зелено. | Для каждого инвалидирующего поля тест сам содержит негативную сторону (если бы поле не входило в ключ, `assert.notStrictEqual(next, first)` упал бы) — явный caught-свидетель в тесте, не внешний мутант. Два поля дополнительно застрахованы зарегистрированными мутантами `zigbee-mapping-ignores-entity-material` и `zigbee-mapping-ignores-user-owner` (id зарегистрированы, не исполнялись). |
| AC3 | Существующие 7 native-смоков (controls, device_hit_capsules, device_signal, device_signal_settings, device_signal_topology, zigbee_tooltip_layout, zigbee_topology_hover) выполнены и PASS внутри Validate на точном материале; состав совпадает с моим собственным прогоном `smoke-select`. Прочитан код: `TOPOLOGY_STALE_MS`, геометрия (`zigbeeArrowGeometry`), resolver (`resolveMappedTopologyHover`) и все пороги не изменены диффом — проверено чтением, не исполнением. | Native-смоки сами являются негативным свидетелем регрессии геометрии/hover; порогов/TTL в диффе нет, поэтому отдельного мутанта на этот AC не требуется. |

## Прочитано и корректно

- `src/zigbee-topology.ts:137-160` — `memoizeTopologies` сравнивает все 7 полей
  `HaRegistrySnapshot` (`devices`, `entities`, `revision`, `authoritative`,
  `access`, `lastSuccess`, `error`) по значению/identity — ни одно поле типа не
  пропущено (сверено с интерфейсом в `src/ha-binding-status.ts:19-29`).
  Скалярные поля копируются (`{ ...registry }`), поэтому мутация входного
  wrapper после сохранения памятки не протекает в неё задним числом (тест
  "scalar metadata is captured…", строка 153).
- Стабильность identity `devices`/`entities` в режиме `authoritative` уже
  обеспечена существующим (не изменённым этой задачей) кодом
  `haRegistrySnapshot` (`src/ha-binding-status.ts:249-271`): проекция
  переиспользует `entry.projectedDevices/projectedEntities` пока `revision` не
  выросла, так что новый wrapper из `hass.devices` не создаёт новую памятку
  зря — именно это и описано в ТЗ как корень проблемы, и именно сюда
  приземляется ключ.
- `src/hp-zigbee-topology-overlay.ts:155-161` — убрано безусловное
  `this._mappedMemo = undefined` в post-render `updated()` при
  `markerInputsChanged`; `render()` уже вызывает `memoizeTopologies` с полным
  семантическим ключом, повторное обнуление в lifecycle-хуке просто сводило на
  нет весь выигрыш. Явные точки сброса (`disconnectedCallback`,
  `_acceptRuntime` при смене runtime/владельца/пользователя) сохранены — это
  не брешь, а намеренная граница.
- Три новых mutation-декларации (`scripts/mutation-registry.mjs`) — не
  шаблонные: каждая целится в отдельный, реально различимый регресс (всегда
  пересчитывать; игнорировать entity-часть реестра; игнорировать владельца/
  пользователя), у каждой есть `because` со ссылкой на конкретный AC, `find`
  строка дословно совпадает с текущим исходником (проверено diff'ом).
- Трейлеры `Issue:`/`User-Visible:` на месте на обоих commit класса A/B
  (`5b61560a` — product, `yes`; `dbac3876`, `6d224777` — B-only, `no`);
  docs-only `89b67f18`/`0a029fea` корректно без трейлеров. `User-Visible: yes`
  сопровождается правкой обоих changelog в том же коммите `5b61560a`
  (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) — формулировки идентичны по
  смыслу RU/EN, числового значения, которое могло бы разойтись по источнику,
  текст не содержит (явный отказ от заявления миллисекундного выигрыша,
  согласованный с ТЗ "Не-скоуп").
- `docs/release-ledger/v1.80.1/906.json` — классификация `stable-fix`
  обоснована и проверена: identity-memo и hover существовали уже в `v1.80.1`
  (`git show v1.80.1:src/hp-zigbee-topology-overlay.ts` — тот же баг на старой
  строке 504), это не доставка новой бета-функции.
- `scripts/monolith-baseline.json` (`bundleBytes` → 2940437) меняется только
  в отдельном commit `6d224777` с собственным обоснованием (owner-approved
  shared centre, issue #911) и не связан с продуктовой правкой #906 по
  существу — не входит в предмет этого ревью, не требует отдельного
  `Release:` трейлера (не трогает `dist/**`/`demo/golden/baselines/**`).
- Риск-класс по изменённым хункам (render-путь оверлея) учтён владельцем
  через `ci:golden` (конвейер сам выставил метку до Validate, #827) — golden
  PASS на точном материале подтверждён (attempt1), что требовалось для треков
  с визуальным риском.

## Находки

Нет. High: 0, Medium: 0.

## Чего не проверял

- Native browser smokes (сами файлы `smoke_*.mjs`) не переисполнял в этой
  песочнице — `demo.local` не резолвится (нет записи в `/etc/hosts`,
  окружение здесь не настроено как демо-харнесс). Эти же 7 строк уже
  фактически выполнены и зелены внутри Validate CI на точном материале
  (browser-шарды attempt2), поэтому для AC3 это не пробел, а перенос
  доказательства на CI-прогон, который я независимо сверил по `gh run
  view`/`gh api`.
- `npm run invariants` и `pytest tests_backend` не прогонял — диапазон не
  трогает геометрию модели (чистая функция `mapTopologies` не изменена, меняется
  только то, когда вызывается её результат) и не содержит Python.
- Отдельный `golden:verify` локально не перезапускал — golden уже выполнен и
  PASS внутри Validate на этом самом SHA (attempt1), повторный прогон здесь
  дублировал бы уже учтённое доказательство, а не добавил новое.
- Исходную причину флакового `smoke_sections_resize.mjs` (shard 3/3, attempt1)
  не расследовал — файл и путь, к которому он относится (сайзинг секций),
  не пересекается с диффом #906 (только `src/zigbee-topology.ts` и
  `src/hp-zigbee-topology-overlay.ts`); автор уже честно задокументировал это
  как неустановленную причину (не "flaky" как установленный диагноз) и внёс в
  `batch-findings-2026-10-15.json` по прямому поручению владельца не заводить
  новые issue для таких находок вне этой задачи. Повторного расследования
  этого несвязанного пункта в рамках code-review #906 не требуется.
- Мутанты (зарегистрированные и прочие) не исполнял — ни вручную, ни через
  registry CLI, ни временным патчем продукта/сборки/гарда: это запрещено вне
  ночного workflow общей политикой (#905), включая ревьюеру.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/906-zigbee-mapping-reuse`, коммит `0a029feaa9d7` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `45783c31f5c9ec071f31f488c354f29f4704b077`
  ```
  git log --all --format='%H %T' | grep 45783c31f5c9
  ```
- Тело issue: `548082a4e45fb6bdfdc027128fc9b9c00244ef4869ec8b1052682a5d67a02d78`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ1NzEsIm91dHB1dF90b2tlbnMiOjE3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0NjU2fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxMjAsIm91dHB1dF90b2tlbnMiOjQxNDYwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE1Mzc2MiwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjY0MjcyMjYsImNvc3RVc2RFc3RpbWF0ZSI6Mi4zMTUzMzMxOTk5OTk5OTk1fV0sInR1cm5zIjo2NiwiZHVyYXRpb25NcyI6Njc2MDE2LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6Mi4zMTk5ODkxOTk5OTk5OTkzLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=4691 output_tokens=41477 cache_creation_input_tokens=153762 cache_read_input_tokens=6427226 num_turns=66 -->
