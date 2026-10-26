# SPEC-REVIEW-1015-r1

Issue: #1015 — «Срок жизни legacy-веток конфига: политика заката совместимости и
инвентаризация»
Трек: `ask`
Этап: `spec`
Материал: тело issue #1015 (bodyDigest `ace11c594825a446ef2756c36fe9afdb331d11470bb24681c315e5369e71c466`),
раздел `## ТЗ`; комментарии владельца 2026-10-23/2026-10-25/2026-10-26
(`#issuecomment-6374255925`, `-6374256784`, `-6394484827`, `-6416154576`).
Заход r1 · блокирующих циклов 0/4.

## Скоуп ревью

Оценивается только ТЗ (раздел `## ТЗ` тела issue) по PROCESS.md §2.4/§2.5/§7.1:
обязательность разделов, однозначность и доказуемость каждого AC, отсутствие
непомеченных предположений, отсутствие продуктовых вопросов, вынесенных
владельцу без необходимости. Кодовый Validate не запускался — на `S4-spec-review`
он не требуется, код задачи не начат (комментарий «Взял» фиксирует: «Код не
начат, S6/WIP слот не занимаю»).

## Как проверялось

1. Прочитаны обязательные источники роли: `docs/SCOPE.md`, `AGENTS.md`,
   `docs/process/REVIEWER.md`, `PROCESS.md` §1, §2.3–§2.6, §7.1–§7.2 (разделы,
   которыми закрывается решение).
2. Прочитано тело issue #1015 целиком, включая раздел «Что показал аудит»,
   «Что сделать», «Что разобрать на аналитике», «Границы» (контекст,
   предшествующий `## ТЗ`) и все четыре комментария владельца/автора,
   формирующие окончательный контракт (два полных стабильных релиза;
   обязательная версионная миграция для пропустивших релизы/старых копий вместо
   отказа).
3. Сверены ссылки на существующую инфраструктуру, на которую опирается
   контракт ТЗ, чтобы отличить обоснованные технические решения от
   непомеченных предположений:
   - `docs/CONFIG-COMPATIBILITY.md` — текущий реестр уже содержит `introduced`/
     `status`/`migration`, но не `since`/`until` (подтверждает собственное
     утверждение issue, что политики заката нет);
   - `docs/CONFIG-COMPATIBILITY.md` §«Crash-resumable config/layout pairs
     (#491)» — подтверждает, что `optimize_pending`/durable-intent/
     write-fence уже существуют, на них можно опереться в контракте миграций,
     а не изобретать заново;
   - `scripts/config-field-registry.mjs` — формат записи (`introduced`,
     `status`, `migration`, `enforcedBy`) расширяем под `since`/`until` без
     структурных противоречий;
   - `docs/audits/parallel-paths-1018-disposition.md` — подтверждает, что
     решения по compatibility-веткам были сознательно отложены именно на
     #1015 («outside #1018/#1015 sunset decisions»), конфликта скоупа с #1018
     нет;
   - `docs/STATUS.md` — текущий latest stable `v1.82.0`, текущая бета
     `v1.83.0-beta.2`: путь `docs/release-ledger/v1.82.0/1015.json` в разделе
     «Release-артефакты» назван корректно относительно предыдущего stable.
4. Доступный `run_check` оракул не вызывался: конкретного непокрытого вопроса,
   требующего адресной проверки осуществимости или negative-input кейса, не
   возникло — все спорные формулировки разрешились чтением существующей
   документации/кода реестра (см. выше).

## Гейты

| Гейт | Прогнан | Почему |
|---|---|---|
| `tsc`/`build`/`npm test`/`gate:small` | Нет | Этап `spec`: кодовый Validate не требуется (PROCESS.md §8, REVIEWER.md «Объём гейтов»); кода нет |
| Адресная проверка осуществимости / negative-input | Нет | Ни один AC не оставил конкретного непокрытого вопроса после чтения материала — см. «Как проверялось» |
| Чтение обязательных источников роли и `## ТЗ` целиком | Да | Обязательный шаг ревью ТЗ |
| Сверка контракта с существующей документацией подсистемы (`CONFIG-COMPATIBILITY.md`, `config-field-registry.mjs`) | Да | Проверка, что технические решения ТЗ не изобретают несуществующий механизм и не противоречат текущей схеме |

## Обязательные разделы (§7.1)

Присутствуют и по существу: Сценарий · Что человек увидит до и после ·
Проблема · Скоуп и Не-скоуп · Контракт поведения · UX и доступность · Модель
данных и миграция · i18n · Критерии приёмки AC1–AC8 (каждый со способом
доказательства) · План автотестов · Риски · Откат · Release-артефакты.
Дополнительно есть раздел «Принято предположительно, поменять свободно»
(не обязателен, но корректно используется для отделения технических решений
от продуктовых).

Сценарий называет персону (администратор/разработчик, `docs/SCOPE.md`) и
момент встречи (обновление через несколько stable, восстановление старой
копии). «Что человек увидит» сформулировано без терминов реализации
(«по-прежнему открываются с прежним смыслом и видом», «сервер хранит текущую
форму», «повторная загрузка не запускает ту же миграцию снова»).

## Находки

Находок, блокирующих вердикт (High/Medium в скоупе), не обнаружено.

Наблюдения Low, не требующие возврата автору (сняты ревьюером с записью,
§2.4/§3 п.8):

- **L1.** AC1 формулирует защитный критерий («отсутствие/некорректный срок
  отклоняется»), но не называет явно, каким фикстурным negative-кейсом это
  будет показано (у AC4/AC5/AC2 такой кейс назван буквально: «unknown
  version/corruption», «failure/concurrency», «orphan/missing/duplicate»).
  Контекст issue («Что сделать» п.4: «тест, что каждая запись
  CONFIG-COMPATIBILITY.md несёт `until`») делает способ проверки однозначно
  выводимым, поэтому это не самостоятельная неоднозначность — снимаю без
  возврата.
- **L2.** AC2 заявляет скоуп «src/**/*.ts и связанного backend», но называет
  способ доказательства одним словом «unit», не уточняя, входит ли сюда
  отдельный pytest-проход по Python-части инвентаризации (в отличие от AC3–AC5,
  где backend/HA-harness проверки названы явно). Технический выбор
  представления (единый Node-скрипт, читающий оба дерева, как уже делает
  `scripts/config-field-registry.mjs` для backend-схемы) снимает
  неоднозначность по существу; явного расхождения в поведении это не создаёт.

Ни одно из двух наблюдений не меняет доказуемость AC и не квалифицируется как
Medium: оба разрешаются однозначным выводом из остального текста ТЗ и
существующей инфраструктуры, а не требуют продуктового решения владельца или
переписывания контракта.

## Что проверено и корректно

- Оба продуктовых вопроса, вынесенных владельцу в `S3-spec` (срок жизни ветки;
  судьба пропустивших релизы/старых копий), получили явные ответы
  (`#issuecomment-6394484827`) и инкорпорированы в «Контракт поведения» без
  потери смысла: «два полных стабильных релиза» определено точно (только
  опубликованные stable, без beta/календаря, по фактическому порядку
  релизов/тегов, не арифметикой `X.Y+2`); «не отказывать старой копии только
  из-за истечения срока» закреплено как «цепочная версионная миграция»
  (AC4) и как условие для самого удаления ветки (AC6: «срок не вышел,
  migration ещё не доказана... — сохранить ветку»). Технических вопросов,
  ошибочно вынесенных владельцу, не найдено — оба вопроса были о видимом
  пользователю объёме обратной совместимости, что прямо попадает в
  «владельцу задаются только продуктовые вопросы» (PROCESS.md §7.1).
- Открытых продуктовых вопросов в тексте ТЗ не осталось (требование DoR,
  §2.5): оба вопроса из `S3-spec` закрыты, `blocked` снят автором при входе в
  `S4-spec-review`.
- Контракт не вводит поведения, не подтверждённого ни одним документом и не
  помеченного как допущение: ссылки на «crash-resumable pair»,
  `write_lock`/`expected revisions`, `model_version`/`rev` соответствуют уже
  описанным в `docs/CONFIG-COMPATIBILITY.md` механизмам (`optimize_pending`,
  CAS `expected_rev`/`expected_config_rev`), а не изобретают новый. Формат
  `since`/`until`/`provenance` — прямое расширение существующей схемы записи
  реестра (`introduced`, `status`, `migration`), не второй backlog (явно
  оговорено в «Модель данных и миграция»).
- Не-скоуп корректно выводит рантайм-only fallback (`legacyRadarPanels`/
  `legacyRadar` — состояние диалога) и прочие небазовые исключения
  (HA provider/API compatibility, forward-compatible unknown fields) из-под
  действия новой политики заката, не позволяя спутать их с persisted-формами
  при инвентаризации (AC2, «Модель данных и миграция»).
- Отсутствие конфликта скоупа с соседними задачами: #1014 (правило удаления
  прежнего пути для новых замен) явно указан в «Границах»; #1018
  (параллельные пути) по независимому источнику (`docs/audits/
  parallel-paths-1018-disposition.md`) сам сознательно откладывает
  compatibility-ветки на #1015 — пересечения скоупа нет.
- Release-артефакты и путь `docs/release-ledger/v1.82.0/1015.json` согласованы
  с текущим состоянием репозитория (`docs/STATUS.md`: latest stable
  `v1.82.0`).
- AC помечены способом доказательства (`unit`/`backend`/`smoke`/`golden`/
  «ревью кода») согласно §2.5; защитные критерии (AC2, AC4, AC5, AC7) называют
  конкретный негативный случай внутри самого текста AC (orphan/missing/
  duplicate; unknown version/corruption; failure/concurrency; current/
  not-applicable/future-prerelease не выдаются за истёкший срок).
- Объём задачи (политика + инвентаризация + миграции + снятие доказанно
  зрелых веток + защита реестра) — сознательный выбор автора не делить задачу,
  несмотря на то что в исходном запросе владельца такое разбиение
  рассматривалось («Трек: ... Возможно, разбить»). Разбиение/неразбиение
  задачи — объём, который пользователь не наблюдает; решение остаётся за
  автором (PROCESS.md §7.1, «Всё, чего пользователь не наблюдает, агенты
  решают сами») и не блокирует ревью ТЗ.

## Чего не проверял

- Код задачи не существует (issue ещё не в `S5-ready`): код-ревью, mutation-
  доказательства, фактическое исполнение тестов/гейтов — не предмет этого
  этапа.
- Фактическая git-археология конкретных 223 упоминаний (реальные `since` по
  commit/tag для каждой ветки) не воспроизводилась — это содержание самой
  инвентаризации (AC2), а не предмет ревью ТЗ.
- Полная матрица pre-release гейтов (golden, full smokes, performance,
  HA-harness) — не гейт ревью ТЗ (PROCESS.md §8, REVIEWER.md «Объём гейтов»).

## Унаследовано из предыдущего раунда

Неприменимо: это первый раунд ревью ТЗ (r1).

## Вердикт

**Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0 ·
Документ: docs/reviews/SPEC-REVIEW-1015-r1.md**

Побочных находок вне скоупа этой задачи не обнаружено (policy mode=`issues`,
`outside_findings` пуст).

Route: `fix` (этап `spec`/трек `ask` — маршрут `reclassify` применяется только
к код-ревью `show`, PROCESS.md §5).

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjU5ZWVhNzcyNjEwM2FhZmY1YWI2ZmU4YjFlNmJiMDBmYTNlZGMyM2NjYjQ3NDFiZjlkYTllYThkYTA5Y2M1ZDQiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI3MGY1YjYxNDM2ZTE0ZmQ3N2NiNDA4ZjdlYzVmYzc1NTEyNmZjMDY4NjYxNGZlNWZhMzBhMTlhNDUwOTdjYjc3IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDE1LCJzdGFnZSI6InNwZWMiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiI4Yjc0ZTc4ODg4MWVmYWYxNWMwZmUyNGUwMjk1NDkyNmUyNDljNDY2IiwidHJlZSI6ImEyNjU4ZWM1NWMwMTU2YWE4ODVmMjA3ZDA4YzI1MGM1ZDFiZTU5MDciLCJib2R5RGlnZXN0IjoiYWNlMTFjNTk0ODI1YTQ0NmVmMjc1NmMzNmZlOWFmZGIzMzFkMTE0NzBiYjI0NjgxYzMxNWU1MzY5ZTcxYzQ2NiIsInByb2R1Y2VyUnVuIjoiNDAzMjM4OTQxMDciLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjY3ZDEzOWEyMzBlNjA0NzE1Y2Q3YzE1ZDEwNGJhMGUyMjAwNWQ3MzYyN2EyYzBiMjYwZDVkY2MwMGFlMjNlZmIiLCJ2ZXJkaWN0RGlnZXN0IjoiZDE4ODViNTQ4ZDg2NjZmMTQ0MjgzZDBhMmVkMjEwMWU3NTRlMjAyNWZjMzJmMGVhNmZhOTUzMzNiNzk2M2U1YSIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJjZDdiZjRkY2FkYTRmZDExZmVjOGZlOTdlNmU2ODY0MDBjMmY4MWZkOTE0ZWE0Yzg5YjU2YjlhMWIzNzljZmI1IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDE2NDA2MTU5LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDE1I2lzc3VlY29tbWVudC02NDE2NDA2MTU5IiwiYm9keURpZ2VzdCI6IjUxNTk2NGM2Yjc3MjlhYTExNTk1MWU4NDAzYjU1MGIzZmJkNmU0ZjgwOGUxYmNlMDc5MmY3ZmQ2NTM3NzVlYmMifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `8b74e788881e` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `a2658ec55c0156aa885f207d08c250c5d1be5907`
  ```
  git log --all --format='%H %T' | grep a2658ec55c01
  ```
- Тело issue: `ace11c594825a446ef2756c36fe9afdb331d11470bb24681c315e5369e71c466`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NDIsIm91dHB1dF90b2tlbnMiOjI4MDk4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEwODYwOSwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjEzNzM3MzAsImNvc3RVc2RFc3RpbWF0ZSI6MC45OTAyNDYwMDAwMDAwMDAxfV0sInR1cm5zIjoyOSwiZHVyYXRpb25NcyI6MzU0MDQ0LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MC45OTAyNDYwMDAwMDAwMDAxLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=42 output_tokens=28098 cache_creation_input_tokens=108609 cache_read_input_tokens=1373730 num_turns=29 -->
