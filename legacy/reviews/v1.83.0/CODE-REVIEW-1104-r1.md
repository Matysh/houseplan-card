# CODE-REVIEW #1104 — заход r1

Вердикт: красный · заход r1 · блокирующих циклов 0/2 · High: 1 · Medium: 0 · Документ: docs/reviews/CODE-REVIEW-1104-r1.md

Маршрут (#726): `route: fix`.

## Материал раунда

- Этап: `code`, трек: `show`.
- Материал: ровно `c2d1d422071cea6eeec05aff2c14bea46e9f5c4a` (ветка `issue/1104-spec-heading-compat`, 1 коммит
  `c2d1d4220 fix(process): recognize exact published SPEC heading` над merge-base с `origin/dev`,
  подтверждено `read:log`). Дерево `d3ae8630083fc20ae5d1650326d323f6305682fe`.
- Ветка к `dev` не приводилась (трек `show`, #696): материал — ветка как есть; dev опережает на 1
  коммит, слияние без конфликта (не ревизовалось дальше — правило трека).
- Validate-gate на материале подтверждён (`https://github.com/Matysh/houseplan-card/actions/runs/40545572153`,
  review-light proof complete) — переиспользован как контекст, не как замена независимого разбора.

## Скоуп

Инфраструктурная правка общего читателя доставки (`scripts/task-delivery.mjs`): распознать третью
уже опубликованную точную форму заголовка SPEC-ревью (`# SPEC-REVIEW #NN — заход rN`) наравне с двумя
существующими, с привязкой issue/round к имени единственного нового SPEC-файла. Правка по PROCESS §1
(процесс/конвейер), без продуктового кода и без ТЗ (трек `show`). Единственная заявленная цель —
починить совместимость `readCatalogue`/`taskDelivery`, не трогая сам опубликованный документ, его
историю и sealed report (прямая формулировка владельца в теле issue: «Не менять sealed report/receipt,
историю... Канонические формы продолжают работать»).

## Как проверялось

Static-first (#857): прочитаны `docs/SCOPE.md`, `AGENTS.md`, `PROCESS.md` (роль canon, разделы §2.7,
§7.1, §8, §12 и фрагмент «Хранение документов» docs/reviews), `docs/process/REVIEWER.md`, тело issue
#1104 и оба комментария автора (диагноз и хендофф). Независимый разбор diff/log через фиксированный
oracle (`read:diff`, `read:log`), затем сверка с рабочей копией на материале (Read/Glob/Grep) — отдельно
от заявлений хендоффа.

Прослежена логика регекспа в `scripts/task-delivery.mjs:58`: третья альтернатива
`SPEC-REVIEW #${issue} — заход r${round}` добавлена в ту же non-capturing группу, `issue`/`round` — уже
провалидированные числовые значения (из `issueTrailers`/имени файла), литералы `#`/«—» не являются
регекс-метасимволами — инъекции или расширения допустимого множества сверх трёх точных форм нет. Логика
остальных предикатов (publisher/subject/trailers/paths/anchors/tree/status) не тронута.

Адресный прогон: `unit:test/task-delivery-903.test.mjs` выполнен заново фиксированным runner'ом (не
переиспользование авторского лога) → **37/37 PASS**, 7.6 с. Три формы заголовка (включая новую)
проверены на обоих путях (`v1`/legacy trailer), полную каталог/membership/companion семантику и строгую
отрицательную матрицу (чужие issue/round, leading zero issue, trailing zero round, суффикс, неверный
разделитель, `CODE-REVIEW` вместо `SPEC-REVIEW`, отсутствующее тире, неверное слово «round» вместо
«заход» — 8 новых строк добавлено к 7 прежним) — подтверждён независимо.

Отдельно проверено расхождение между декларированным в `REVIEW_CONTEXT.changedFiles` списком (6 файлов)
и фактическим диффом (`read:diff`): реальный патч трогает **8** путей — дополнительно
`docs/reviews/INDEX.md` (изменён) и `docs/reviews/SPEC-REVIEW-1096-r2.md` (удалён), ни один не назван ни
в `changedFiles`, ни в хендоффе автора («Файлы: ...»). Это и есть предмет находки H1 ниже; оба файла
перепроверены чтением рабочей копии на материале (не только по diff-тексту).

## Находки

### H1 (High, в скоупе) — коммит необратимо удаляет уже запечатанный `docs/reviews/SPEC-REVIEW-1096-r2.md` и его строку каталога, вопреки явному запрету issue и собственному заявлению автора

**Воспроизведение.** `read:diff` (`origin/dev...HEAD`) содержит:

```
diff --git a/docs/reviews/SPEC-REVIEW-1096-r2.md b/docs/reviews/SPEC-REVIEW-1096-r2.md
deleted file mode 100644
index fb7a6ea74..000000000
--- a/docs/reviews/SPEC-REVIEW-1096-r2.md
+++ /dev/null
@@ -1,177 +0,0 @@
-# SPEC-REVIEW #1096 — заход r2
...
diff --git a/docs/reviews/INDEX.md b/docs/reviews/INDEX.md
@@ -1,13 +1,12 @@
-...Документов: 179, issue: 86...
+...Документов: 178, issue: 86...
...
-| #1096 | [SPEC-REVIEW-1096-r2.md](SPEC-REVIEW-1096-r2.md) | spec · r2 | 🟢 зелёный | 0 | 0 | — | — |
```

Подтверждено независимо чтением рабочей копии на материале: `Glob docs/reviews/SPEC-REVIEW-1096-r2.md`
→ файл отсутствует; `docs/reviews/INDEX.md` действительно содержит «Документов: 178» и только строку
`#1096 | SPEC-REVIEW-1096-r1.md | spec · r1 | 🟡 ...` — строки r2 нет.

**Почему это дефект, а не генератор.** Удалённый документ — ровно тот «подлинный» SPEC1096r2
(в дереве `e4c0c75da4`, исходный коммит `80349ae3`), ради признания H1 которого заведена вся задача
#1104: тело issue прямо требует «Сохранить... Не менять sealed report/receipt, историю... Канонические
формы продолжают работать», а хендофф автора утверждает «история и sealed report не изменялись»,
«Отчёт 80349ae3 и история не переписаны» и «Продуктовые файлы... не менялись» — ни то, ни другое не
соответствует фактическому диффу. Правило хранения документов зафиксировано в самом PROCESS.md: «в
`docs/reviews/` лежат все раунды всех задач текущей линии... Ручная правка каталога... удаление —
сопровождается пересборкой индекса... index меняет генератор, а не рука»; единственный предусмотренный
путь удаления — перенос в `legacy/reviews/<vX.Y.Z>/` отдельным коммитом класса C как часть чеклиста
стабильного релиза (`reviews-archive.mjs --through=vX.Y.Z`). Здесь документ не перенесён, а стёрт внутри
не относящегося к этому инфраструктурного коммита, без какого-либо упоминания в теле issue/хендоффе.
`candidate-reviews-index.mjs` при слиянии лишь перестраивает `INDEX.md` из уже принятого дерева — он не
восстановит исчезнувший исходный `.md`; при слиянии как есть пропажа станет постоянной в `dev`.

**Последствие.** Потеря зелёного исторического ревью-документа (аудиторского следа) из живого каталога
вне единственного санкционированного пути, в прямом противоречии явному ограничению скоупа задачи и
недостоверный хендофф («не изменялись» — изменились). Это дефект корректности скрытого пути (трек
`show`, `docs/process/REVIEWER.md` «Трек show»): задача должна **только** научить читателя распознавать
форму заголовка, не трогая сам документ.

**Чем краснеет.** Обычный негативный вход, не мутант: `Glob docs/reviews/SPEC-REVIEW-1096-r2.md` на
материале `c2d1d422` возвращает пусто (ожидался файл); `Grep '#1096' docs/reviews/INDEX.md` возвращает
только строку r1 вместо двух строк r1+r2, с «Документов: 178» вместо «179» — оба факта проверены
исполнением обычных read-инструментов на материале, не мутацией реализации.

**Что нужно исправить.** Восстановить `docs/reviews/SPEC-REVIEW-1096-r2.md` (байт-в-байт, как в
принятом `dev`) и строку `#1096 | SPEC-REVIEW-1096-r2.md | spec · r2 | 🟢 зелёный | 0 | 0 | — | —` в
`docs/reviews/INDEX.md` с «Документов: 179» в том же коммите, либо убедительно объяснить владельцу, по
какому out-of-band пути документ был утерян ещё до этой задачи, и провести удаление через штатный
`reviews-archive.mjs` отдельным коммитом, если это действительно требуется релизным чеклистом (что
данная задача не заявляла).

## Что проверено и корректно

- Регексп-логика в `scripts/task-delivery.mjs:58`: третья альтернатива синтаксически корректна, не
  расширяет допустимое множество сверх трёх точных строк, `issue`/`round` — провалидированные числа без
  риска регекс-инъекции; остальные 11 предикатов (publisher, subject, terminal trailers, phase,
  User-Visible, пути ровно SPEC+INDEX(+companion), anchors, tree, status) не изменены и по-прежнему
  обязательны — подтверждено чтением и прогоном теста.
- `test/task-delivery-903.test.mjs` — полная положительная матрица (3 заголовка × v1/legacy) и строгая
  отрицательная матрица (16 некорректных заголовков + 10 вариантов порчи остальных предикатов) проверены
  заново независимым прогоном: **37/37 PASS**. Тест умеет падать: отрицательные ветки проверяют именно
  то поведение, которое могло бы регрессировать при неосторожном ослаблении регекспа (например,
  «# SPEC-REVIEW #02 — заход r1» и «# SPEC-REVIEW #2 — заход r01» с ведущим/хвостовым нулём корректно
  отклоняются).
- `PROCESS.md` §7.1 и `docs/STATUS.md` описывают именно то поведение, которое добавлено в ридере
  (с поправкой на находку H1 ниже — формулировка «не переписывает опубликованный отчёт» фактически не
  подтверждена диффом).
- `docs/release-ledger/v1.82.0/1104.json`: категория `infra`, обоснование соответствует фактическому
  изменению (без учёта H1); `scripts/ci-registry-inventory.json` — ровно две добавленные строки
  включения нового ledger-файла, консистентно с соседними записями.
- Трейлеры `Issue:`/`User-Visible:` — не доступны для независимой проверки текущим набором oracle
  (только `read:diff`/`read:log`/`read:base:*`, без доступа к полному телу сообщения коммита); по
  контексту (`infra`-классификация, отсутствие продуктового изменения) `User-Visible: no` ожидаемо, но
  это не было подтверждено выполнением — см. «Чего не проверял».

## Чего не проверял

- Полное тело коммита (`Issue:`/`User-Visible:`/`Delivery-Phase:` трейлеры дословно) — доступные
  фиксированные проверки (`read:diff`, `read:log`) не дают полного commit message; `read:log` вернул
  только oneline-подпись. Честная граница: не исполнено, не являюсь «не PASS» по отсутствующим данным.
- `build`/`typecheck`/`bundle:sync` и полный `gate:small` — не перезапускались: материал не меняет
  исполняемый продуктовый код приложения (только `scripts/`, `*.md`, JSON-реестр), точный-SHA CI
  (`tooling40543559849`, `docs40543560044`, оба SUCCESS) уже покрывает эти прогоны на этом SHA и
  переиспользован как контекст, а не повторён.
- Смоки/Golden/`pytest tests_backend`/`npm run invariants` — не относятся к диффу (нет продуктового UI,
  Python или геометрии); целевых AC на них нет.
- Происхождение самого удаления `SPEC-REVIEW-1096-r2.md` (случайность локального инструментария автора
  против намеренного шага) — не моя обязанность реконструировать; обязанность автора объяснить и
  исправить до следующего раунда.

## Гейты

| Гейт | Прогнан | Результат/почему |
|---|---|---|
| `read:diff`, `read:log` | Да | Материал подтверждён неизменным; полный дифф/лог прочитаны адресно. |
| `unit:test/task-delivery-903.test.mjs` | Да (заново) | 37/37 PASS, 7.6 с — целевой AC-тест на изменённый ридер. |
| Чтение рабочей копии (`docs/reviews/SPEC-REVIEW-1096-r2.md`, `docs/reviews/INDEX.md`) | Да | Подтвердило H1 независимо от текста diff. |
| `build`/`typecheck`/`bundle:sync`/полный `gate:small` | Нет (переиспользован контекст) | Материал не меняет исполняемый продуктовый код; точный-SHA CI уже зелёный (`runs/40543559849`, `runs/40543560044`); доп. прогон не даёт нового сигнала по риску H1. |
| Смоки / golden / `pytest tests_backend` / `npm run invariants` | Нет | Вне диффа и AC (нет продукта/Python/геометрии). |
| Трейлеры `Issue:`/`User-Visible:` коммита | Нет (нет oracle) | Доступные fixed-check'и не отдают полное тело сообщения коммита; честно отмечено как непроверенное, не как PASS. |

## Итог

Правка регекспа и тестов для третьей опубликованной формы H1 сделана аккуратно и подтверждена
независимым прогоном (37/37 PASS), остальные 11 предикатов доставки не ослаблены. Но фактический
материал этого раунда одним и тем же коммитом необратимо удаляет уже принятый в `dev` sealed
SPEC-ревью-документ `#1096` r2 и его строку в `INDEX.md` — ровно то, что issue прямо запрещает трогать, и
ровно противоположное тому, что заявляет хендофф автора. High, вердикт красный, маршрут `fix`:
требуется восстановить удалённые файлы (или обоснованно провести их перенос штатным
`reviews-archive.mjs` отдельным коммитом) в следующем раунде.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjFkZjdmZjUxODgyOWRmMzc5YzI3MTQzNjE3ZmRiNTQ4YTkwMzQwMTI4N2M5MzgwNWUyMTMzZGM2ZDI3NmZjOTMiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiJhYmFiMDdlNWJiN2M3MzEyZTQ1NmMwNTVhOGIwYTI2NThjYjhiN2VkNmNiMDNlMTc1ODQ1MGMxMzU4ZTMxMTczIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTA0LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiJjMmQxZDQyMjA3MWNlYTZlZWVjMDVhZmYyYzE0YmVhNDZlOWY1YzRhIiwidHJlZSI6ImQzYWU4NjMwMDgzZmMyMGFlNWQxNjUwMzI2ZDMyM2Y2MzA1NjgyZmUiLCJib2R5RGlnZXN0IjoiN2NjMDk5NjMwNTVjNTBkYjhhYzk0MDFmNDc3YmQyYzZkNjljM2MwZDhmNTllMGY4ZmI2MGFlYjZmYTI1NTlmMyIsInByb2R1Y2VyUnVuIjoiNDA1NDY4NzcxNjMiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjQ4YjY5NDhhOGE5MTRhODA0ZDMzOTViNzBhODI2MzQwODEzNjIyOWJmNmE1NjMyNmIwMWQ1ZGI3MGM4NzkxNTIiLCJ2ZXJkaWN0RGlnZXN0IjoiMGNkMzIyMmU2Yjc3MDA2NTE3N2Y5MzRiMWI5MjY5YzkxMjY5Y2MyN2ZhYzBkYTA0MTE4NmZmY2E2ZTA1NTgzOSIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiIyZTVlMTlmYzRjYzM1NTdlM2UzMDc1Y2YyM2Q1NWNkM2IwZTRjMmU5ZGYzNTEzNWM5OTY0NjM4YmNmNTViOTM3IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDQ4NDkwODI1LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTA0I2lzc3VlY29tbWVudC02NDQ4NDkwODI1IiwiYm9keURpZ2VzdCI6IjRkMDlhMjdjNTZhMzM3ODg5NzI3ODhiNjhkNWIxMjk3M2M2MTBiN2ZiOGM2MGEyZDUyNzkwMTdjMDY0ZTZkNjAifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1104-spec-heading-compat`, коммит `c2d1d422071c` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `d3ae8630083fc20ae5d1650326d323f6305682fe`
  ```
  git log --all --format='%H %T' | grep d3ae8630083f
  ```
- Тело issue: `7cc09963055c50db8ac9401f477bd2c6d69c3c0d8f59e0f8fb60aeb6fa2559f3`
- Вердикт конвейера: `red` · High 1 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NDAsIm91dHB1dF90b2tlbnMiOjMxNjQzLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE0MDU3MSwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjE2OTg1NTcsImNvc3RVc2RFc3RpbWF0ZSI6MS4yMTg1MDU0fV0sInR1cm5zIjoyOSwiZHVyYXRpb25NcyI6NDE0MjM1LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS4yMTg1MDU0LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=40 output_tokens=31643 cache_creation_input_tokens=140571 cache_read_input_tokens=1698557 num_turns=29 -->
