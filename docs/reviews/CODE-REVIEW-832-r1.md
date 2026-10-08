# CODE-REVIEW-832-r1

Issue: #832 · Трек: ask · Этап: code · Заход r1 · блокирующих циклов 0/4
Материал: `cea265e614a863efa4f80177eed6b18eb822b0f5` (ветка `issue/832-repeat-resize-diagnosis`,
3 коммита поверх `origin/dev`: `b0301088`, `1ee6e440`, `cea265e6`)

## Скоуп

ТЗ (тело issue, редакция r2, оба раунда SPEC-REVIEW зелёные) требует: coalesced
Resize-контур (whole-side handles) спроецировать обратно на frozen stored wall
atoms/ordered `wall_ids` до существующих strict physical/junction/metadata proofs,
не ослабляя их; соседи общего ID синхронизируют только derived collinear seam
point на неизменном carrier; допускается один частный случай настоящего
structural split у неподвижного угла третьего владельца, ограниченный frozen
changed-ID owner closure. Диапазон риска из промпта (`resize-atom-projection.ts`
целиком + call-site в `houseplan-editor-runtime.ts`) — это ровно предмет ТЗ
AC1–AC5; других классов в диффе нет (docs/scripts/demo — сопутствующие правки
того же факта). Вопрос трека ask "каждый класс покрыт AC" закрыт: риск и ТЗ —
одно и то же.

## Как проверялось

| Гейт | Статус | Как подтверждено |
| --- | --- | --- |
| typecheck / `npm test` / `npm run build` + bundle-policy | PASS | Зелёный Validate на точном SHA материала, дважды: [run 37807785457](https://github.com/Matysh/houseplan-card/actions/runs/37807785457) (push) и [run 37808506808](https://github.com/Matysh/houseplan-card/actions/runs/37808506808) (метка). Не перегонял — #343. |
| `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test test/resize-atom-projection.test.mjs` | PASS, 13/13 | Прогнал сам. Дополнительно вручную внёс мутацию `resize-atom-fixed-breakpoint-translated` (отключил fail-closed ветку в `applyResizeAtomProjection`) — тест покраснел (2 fail из 13), затем восстановил файл и перепроверил зелёный — тест действительно умеет падать. |
| `node --test test/core-file-budget.test.mjs` | PASS, 7/7 | Прогнал сам (проверка потолка `+51` строк core, вынесенного в helper). |
| `node demo/benchmark_safe_resize.mjs` | PASS | Прогнал сам: pointer p95 0.0083 ms < 16, commit-preflight p95 0.0018 ms < 75, 20 cache entries < 4096. |
| `node scripts/model-invariants.mjs --config test/fixtures/real-plan-second-floor.json --json` | Один известный **унаследованный** `partition_over_room_wall` (room-c, 220 шагов) | Прогнал сам на трекнутой фикстуре — ровно та находка, что автор документировал как существовавший до #832 долг, новых находок нет. |
| `node scripts/process-gate.mjs --range origin/dev..HEAD --issues --report` | PASS, 0 WARN | Прогнал сам. |
| `npm run inventory` | Node unit 3917 — совпадает с числом в `docs/STATUS.md` | Прогнал сам, число одно и то же в STATUS и в живом прогоне. |
| golden:verify (205/205), browser-смоки (3 шарда), perf_smoke | PASS | Не перегонял руками (дорого) — **живой CI-прогон** [run 37808506808](https://github.com/Matysh/houseplan-card/actions/runs/37808506808) на точном SHA материала реально выполнил (не переиспользовал из кэша) jobs «Golden-кадры», «Смоки в браузере» ×3, «Перф-смок», все `success`. Это сильнее самоотчёта автора — проверено по факту исполнения джобов, а не по комментарию. |
| `mutation-gate.mjs --check` (анкеры) | PASS по заявлению автора (290/200, якоря membership) | Не перегонял — реальные мутанты по правилам трека не гоняются в разработке (#709), только анкеры; раз-в-ночь свидетель `resize-atom-fixed-consumer-handoff-skipped` сам прочитал в реестре и проверил, что патч бьёт именно в `Object.assign(sp, atomCandidate)` — корректная точка отказа для AC1. |
| pytest tests_backend / Python-гейты | Не применимо | Диапазон диффа не содержит правок `custom_components/houseplan/**`; backend job в обоих Validate-прогонах `skipped` закономерно. |
| Полный `npm run gate:small -- --smokes`, полный golden локально, performance локально | Не прогонял | Избыточно: то же самое дерево уже дважды прогнано CI на точном SHA (см. выше); пересборка бандла и три копии не нужны — класс D/бандл не в этом диффе. |

## Находки

Нет. High: 0, Medium: 0, Low: 0.

## Что проверено и признано корректным

- **Устранение исходного symptom (#826-смежный, но независимый).** Корень —
  `coalesceResizeRooms` схлопывал `poly`, не трогая `wall_ids`; новый
  `src/resize-atom-projection.ts` восстанавливает frozen correspondence между
  user-facing coalesced ring (`prepareResizeAtomProjection`/`applyResizeAtomProjection`,
  строки 1–armed through run/corner atoms) и stored topology до любых physical/
  junction proofs. Прочитано построчно (не только тестами): для каждого run
  между двумя "угловыми" coalesced-вершинами ищется единственная цепочка
  stored-вершин по коллинеарности и монотонному `t` вдоль отрезка — попытка
  скрестить breakpoint (`t < lastT`) или не найти однозначное соответствие
  (`matches.length !== 1`) отказывает, не подставляет позиционный fallback.
  Юнит «ring start and reversed physical orientation» перебирает все стартовые
  точки и обе ориентации — не частный случай.
- **Общий ID, два владельца, противоположная ориентация.**
  `projectResizeAtomCatalogue` требует согласия обоих владельцев (forward XOR
  reverse must hold for exactly one orientation) и конфликт двух предложенных
  позиций для одного ID — explicit refuse, не "последний полученный побеждает".
  Подтверждено и чтением, и тестом `atom catalogue rejects conflicting owners`.
- **Compatibility-соседи (§3a).** `projectResizeAtomConsumers` синхронизирует
  только derived collinear точку внутри неизменного run (`onInterior`,
  строгое условие «между, не на конце»), сохраняя толщину (`cm`) соседних
  инцидентных atoms равной — настоящий угол или граница толщины отказывает.
  Негативные юниты: authored corner, mixed-thickness boundary, inconsistent
  incident IDs — все проверены содержательно, не одними названиями.
- **Настоящий structural split (§3, не §3a).** `hasResizeAtomCornerSplit` +
  ветка `projectResizeStoredAtoms` ограничивают материализацию строго
  `frozen changed-ID owner closure` (`prepareResizeAtomContext`): посторонние
  комнаты/проёмы/partition туда не попадают — проверено не только по тексту
  AC, но и "отравленным" `toJSON`, который кидает исключение при попытке
  сериализовать удалённую комнату/проём (тест
  «true split never serializes a remote owner» реально исполняет этот путь:
  я прогнал файл и исключение не сработало, то есть materializer её не
  трогает). Атом, потребляемый внешним владельцем вне closure, обязан остаться
  byte-identical — проверено побайтовым сравнением и негативным кейсом с
  развёрнутой ориентацией внешнего атома.
- **Fail-closed, не маскировка guard.** Легаси exact-multiplicity rekey ledger
  не подменяется количеством материализованных atoms (комментарий в коде и
  тест «preview already has the final structural ownership» сверяет
  `commitWallSegmentModel` после preview с самим preview — они совпадают, то
  есть preview не "отстаёт" от финальной материализации, как было до фикса).
- **Кэш `_resizeAtomMap` в `houseplan-editor-runtime.ts`.** Явно сбрасывается
  в `_rszResetController`, `_rszEdgeDown`, `_rszUp`, `_rszCancelDrag` (кроме
  no-op). Независимо от явного сброса ключ кэша — сама строка
  `_geometrySnapshot()`, неизменная внутри одного жеста и обязанная смениться
  при новом — то есть даже пропущенный явный `= null` не дал бы стейл-чтение
  поперёк жестов; это подстраховка, не единственная линия защиты.
- **Трейлеры и changelog.** Все три коммита несут `Issue: #832` и
  `User-Visible: yes`; в каждом из трёх — правки обоих `docs/CHANGELOG.md` и
  `docs/CHANGELOG.ru.md` (проверено `git show --stat` по каждому SHA отдельно,
  не только по финальному диффу).
- **Единственное видимое число, поднятое в этом диффе** —
  `LAZY_EDITOR_GZIP_CEILING` 252 758 → 255 500 B. Источник один:
  `scripts/bundle-budget.mjs`, с комментарием-ссылкой на явное согласование
  владельца 2026-10-08 (issue-комментарии `issuecomment-6064027141`,
  `issuecomment-6064051879`, прочитаны — оба от `Matysh`, подтверждают именно
  этот потолок и это число). Полоса 2000 B, initial-View и абсолютные бюджеты,
  core ceilings не изменены — проверено чтением диффа `bundle-budget.mjs`
  целиком, не только поднятой строки. `monolith-baseline.json` обновлён тем
  же диапазоном коммитов до фактического bundleBytes (2771465) — согласовано.
- **Документация.** `docs/RESIZE.md`, `docs/WALL-THICKNESS.md`,
  `docs/CONFIG-COMPATIBILITY.md`, `docs/ARCHITECTURE.md`, `docs/STATUS.md`,
  `docs/DEVELOPMENT.md` правлены согласованно и описывают ровно то поведение,
  что в коде (сверено построчно против `resize-atom-projection.ts`, не
  принято на слово).
- **Мутационный реестр.** Пять новых `MUTANT_DEFINITIONS` целятся в конкретные
  строки нового файла/call-site; я независимо воспроизвёл одну из патчей
  (`resize-atom-fixed-breakpoint-translated`) и убедился, что `because`
  соответствует реальному провалу теста, а не декларации.

## Чего не проверял

- Не перегонял полный `npm run gate:small -- --smokes`, `golden:verify` и
  performance_smoke локально — дорогие прогоны, и ровно это дерево уже дважды
  исполнено CI на точном SHA материала (см. таблицу); дублировать смысла нет.
- Не выполнял вручную реальный Resize в браузере (demo-стенд) — полагаюсь на
  исполненные CI browser-смоки (3/3 шарда зелёные на материале) и на
  детальный built-in разбор по чекам внутри
  `demo/smoke_resize_pointer_real_plan.mjs`, который прочитан построчно (в т.ч.
  новый блок `resize_repeat.*`, строки 320–396 диффа) — соответствует AC1/AC3
  по содержанию проверяемых условий.
- Не прогонял полный `pytest tests_backend`/HA-harness — неприменимо, Python
  не менялся.
- Не перепроверял реальные (не anchor) mutation-registry mutants — по треку
  `ask` в разработке они не гоняются ни автором, ни ревьюером (#709), только
  ночным прогоном; я ограничился проверкой одного анкера вручную как
  репрезентативной выборкой подхода.
- Не проверял визуально golden-диффы кадр за кадром — доверяю `success`
  живого CI job (без принятия новых эталонов, baseline не менялся в диффе).
- Слабая связь `smoke-select` на `WallEntry`/`wallKey` указала также на
  `smoke_resize_wall_thickness.mjs` и `smoke_wall_key_roundtrip.mjs`; по коду
  эти символы использованы в диффе только как локальный служебный тип внутри
  closure-ограниченного split-пути, не экспортированы наружу и не меняют
  существующие функции — посмотрел, прогонять не стал (ровно трактовка
  «слабая связь — повод посмотреть, а не обязанность прогонять»).

## Вердикт

Зелёный. AC1–AC5 покрыты исполняемыми доказательствами (юнит + 2 реальных
browser-смока + CI golden/perf), защитные AC имеют непустой столбец «чем
краснеет» и я independently подтвердил, что как минимум один из
соответствующих тестов действительно падает на мутации. Трейлеры, changelog,
бюджет и канон согласованы. Риск по изменённым участкам из промпта полностью
покрыт тем самым ТЗ, по которому писался код — reclassify не требуется.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/832-repeat-resize-diagnosis`, коммит `cea265e614a8` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `ef26bd5f3456843de52e52df0239b62a93de6fdd`
  ```
  git log --all --format='%H %T' | grep ef26bd5f3456
  ```
- Тело issue: `fef66716ecd358088a58a3f1d874009be1ef530f3542bc30a80055e5c1e70aaa`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:usage input_tokens=4217 output_tokens=27074 cache_creation_input_tokens=138984 cache_read_input_tokens=3782837 num_turns=43 -->
