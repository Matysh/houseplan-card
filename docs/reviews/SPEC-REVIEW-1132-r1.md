# SPEC-REVIEW-1132-r1

Issue: #1132 — «Перенести согласованные UI-правки beta 4: панель, печать, значки и внешние экраны»
Трек: `ask` · Этап: `spec` · Заход: r1 · Материал: тело issue #1132, bodyDigest `d56734754fee4a98bcca537e29acbf0b7068c8394999670e323cd51a1ec2cf93`, прочитан dev `72c63464ae88cd5714e60ab68da3d09ae04d39b4` (tree `3d44bd1a0d5316e73e96f877561c068d443c95a4`).

## Скоуп ревью

ТЗ (раздел `## ТЗ` тела issue) закрывает UI-001…UI-012 — перенос согласованного визуала итерации 29–30.10.2026 (panel-header/measured overflow, print dialog, device-icon bevel/Power Off, внешние экраны `controls`, LQI stacking). Судится только ТЗ: осуществимость, однозначность и доказуемость каждого AC; кодовый Validate на этапе `spec` не требуется, продуктовый код не менялся («Исходник продукта пока не менялся», комментарий автора 2026-10-29T22:57:55Z).

## Как проверялось

1. Прочитаны обязательные источники роли: `docs/SCOPE.md`, `AGENTS.md`, `docs/process/REVIEWER.md`; раздел §2.4/§2.5/§7.1/§8/§4 `PROCESS.md` открыт по ссылкам дайджеста.
2. Прочитано тело issue #1132 целиком (все разделы ТЗ) и оба комментария владельца/агента (оценка трека, Сделано/НЕ сделано).
3. Проверены обязательные разделы §7.1: сценарий, что увидит человек, проблема/основание, скоуп и не-скоуп, контракт поведения, UX и визуальная приёмка, модель данных/миграция, i18n, AC1…AC9 с доказательством, план автотестов и гейтов, риски, откат, файлы и release-артефакты — присутствуют все.
4. Сверены технические утверждения ТЗ с реальным деревом dev (адресное чтение, без исполнения): `src/panel-header-flow.ts`, `src/panel-header-menu.ts`, `src/styles/panel-header.styles.ts`, `src/pdf/hp-pdf-dialog.ts`, `src/editors/external-screens.ts`, `src/external-screens.ts`, `src/summary-panel-runtime-loaded.ts` — все названные в разделе «Файлы» модули существуют и по сигнатурам соответствуют описанному поведению (panel header flow, PDF/SVG в одном диалоге, external screens namespace, summary/control оверлей).
5. Сверено совпадение ТЗ с канонами: `docs/DEVICE-PRESENTATION.md` (строки 66–67: текущий `.power-off` действительно дим только внутренний MDI-глиф до 0.35 — UI-010 описывает реальный, а не выдуманный дефект), `docs/CONFIG-COMPATIBILITY.md` (строки 1801–1819: `settings.external_screens` v1 с boolean `controls` уже документирован; выбор ТЗ не удалять поле, а сделать его инертным, не запускает цикл «since/until» ретрита, т.к. поле не удаляется), `docs/USER-GUIDE.ru.md` (строки 3785/3789: «кнопки поверх плана» и `hpcontrols=0|1` — существующая терминология, не изобретённая), `docs/PDF-EXPORT.md` (единый диалог PDF/SVG с общим select — подтверждает осуществимость UI-006).
6. Непокрытый технический вопрос (см. «Находки») закрыт адресным чтением `src/summary-panel-runtime-loaded.ts:208-326` — отдельного исполняемого прогона не требовалось, вопрос текстовый (формулировка ТЗ), а не поведенческий.
7. Design-пакет `4defb9839bc8c4fb858223596651cbac2227a196:docs/design/1132-beta4-ui/2026-10-30/` в текущем dev-дереве отсутствует (это материал ветки `codex/1132-approved-ui`, не dev) — ожидаемо для этапа spec, ТЗ сам говорит, что пакет доставляется в ветку реализации позже. Не проверялся как материал ревью ТЗ и не является находкой этого этапа; его читаемость — забота AC1 на code-review.

## Гейты: что прогнано, что нет, почему

| Гейт | Статус | Причина |
| --- | --- | --- |
| `tsc`/build/`npm test`/`gate:small` | не прогонялся | Этап `spec`: кодовый Validate не требуется (REVIEWER.md «Ревью ТЗ»); код не менялся |
| Адресная проверка осуществимости | выполнена | Grep/Read по названным в ТЗ файлам и канонам (см. «Как проверялось» п.4–5) — все ссылки реальны, нет выдуманных путей |
| negative-input case / `run_check` | не потребовался | Единственный непокрытый вопрос («summary/control overlay») разрешился чтением исходника, это вопрос формулировки ТЗ, а не поведения кода |
| `specFormatErrors(body,'ask')` | PASS (по данным автора, не формальная семантическая проверка) | Формат ТЗ соответствует обязательным разделам — перепроверено вручную по §7.1 (см. выше) |

## Находки

### Medium (в скоупе) — M1: неоднозначная формулировка «summary/control overlay» в контракте UI-011

**Где:** раздел «Контракт поведения» → «Внешние экраны UI-011» тела issue:
> «Во всех Houseplan kiosk входах **summary/control overlay** не рисуется и не становится доступным по keyboard; profile `controls=true`, старый `hpcontrols=1/true` и другие legacy overrides не могут вернуть кнопки.»

**Почему это находка.** В реальном коде (`src/summary-panel-runtime-loaded.ts`) «сводная панель» и «кнопки поверх плана» — два независимо управляемых узла одного компонента:
- `.summary-overlay` (строка 261, гейтится `effectiveShow` = `_externalScreen?.summary ?? local.show`) — собственно содержимое сводки HA-состояний, feature #437, защищена `docs/SCOPE.md` («configurable read-only summary overlay... adds no arbitrary cards... HA administration») и явно не входит в не-скоуп UI-011;
- `.summary-control` (строка ~312: `if (kiosk && (this.host._mode !== 'view' || this.host._externalScreen?.controls === false)) return nothing;`) — ровно та группа кнопок (шестерёнка настроек + переключатель показа), которую UI-011 просит скрыть в киоске всегда.

Фраза «summary/control overlay» в контракте дословно читается как «summary-оверлей **или** control-оверлей не рисуются», то есть может быть прочитана как требование убрать и саму сводную панель — хотя в остальных местах того же ТЗ (строка исходного UI-011, AC7, «Технические решения») последовательно используется только термин «kiosk overlay» применительно к кнопкам, а сводка (`summary`) явно оставлена как в #1113: «Остальные options/rotation/cycle/idle/**summary**/hidden/scales, live adoption и выбор пространства работают как #1113». Сама формулировка одного предложения внутри контракта поведения, однако, допускает обратное прочтение и не содержит явной оговорки «не трогать `.summary-overlay`/`effectiveShow`».

**Последствие при реализации.** Если контракт прочитан буквально, разработчик может скрыть в киоске саму сводку HA-состояний (не только кнопки), что откатит owner-approved фичу #437 вне скоупа этой задачи и будет пользовательской регрессией, которую последующий код-ревью обязан будет поймать постфактум — дешевле снять двусмысленность на этапе ТЗ.

**Чем доказано:** разобрано чтением, не исполнением (`src/summary-panel-runtime-loaded.ts:208-326`, `docs/SCOPE.md` §437-exception, перекрёстная сверка формулировок UI-011/AC7/«Технические решения» внутри тела issue).

**Что нужно поправить в ТЗ:** заменить «summary/control overlay не рисуется» на формулировку, однозначно указывающую, что скрывается только группа кнопок (`summary-control`/«кнопки поверх плана»), а содержимое сводки (`summary-overlay`, управляемое отдельным полем `summary`/`effectiveShow`) продолжает рендериться по правилам #1113 независимо от `controls`. Это технический вопрос формулировки, не продуктовый — решается автором в тексте ТЗ без выхода к владельцу.

## Что проверено и признано корректным

- Все 12 UI-правок имеют единообразную структуру «что изменить → что сохранить», ссылки на предыдущие задачи (#1120/#1119/#1026/#1113) корректно описывают, какие более ранние договорённости заменяются, без скрытого отката неупомянутых решений.
- Каждый AC1…AC9 называет наблюдаемый результат и способ доказательства (unit/native smoke/golden/ревью кода); численные критерии (44 px, 10 px gap, ≤1 CSS px) делают визуальный AC1 в значительной части объективно проверяемым, а не только «посмотреть и согласиться».
- Не-скоуп сформулирован явно и адресно (геометрия, алгоритмы света/Zigbee, activity/alert-приоритет, SVG/PDF scene/writer, формат внешних профилей, порог 1024 px Properties sidebar, лабораторные polling/MutationObserver/CSS-mask) — снижает риск «заодно отрефакторить» за пределами задачи.
- Compatibility-поля (external screens `controls`) решены по `docs/CONFIG-COMPATIBILITY.md`: поле не удаляется и не мигрирует, остаётся читаемым для старых профилей/бэкапов, что не требует запуска ретрит-цикла since/until (#1015) и явно названо решением, а не упущением.
- i18n: явно «новых строк не требуется», условное удаление `screens.controls`/`screens.controls_help` корректно обусловлено отсутствием потребителей по всем языкам (RU/EN/DE/FR).
- Риски перечислены по шести применимым классам (async/данные-ACL/geometry/visual/объём-perf/host-input), откат описан как обычный обратный коммит без персистентной миграции.
- Release-артефакты и план релиза (beta.5 → stable 1.83.0, classification «предварительно stable-fix относительно v1.82.0») названы; запись `docs/release-ledger/v1.82.0/1132.json` корректно отнесена к «перед S7», а не к spec-review gate — её отсутствие сейчас не находка.
- Названные в ТЗ файлы (`panel-header-flow.ts`, `hp-pdf-dialog.ts`, `external-screens.ts`, `summary-panel-runtime-loaded.ts` и т.д.) существуют в dev-дереве и соответствуют описанной архитектуре — ТЗ не описывает несуществующий код.
- Открытых продуктовых вопросов к владельцу в ТЗ нет и не требуется: единственный найденный вопрос (M1) — технический вопрос формулировки контракта, который снимается и решается здесь же, без выхода к владельцу (REVIEWER.md «Ревью ТЗ»: технический вопрос ревьюер снимает сам).

## Чего не проверял

- Не проверялся сам пакет закреплённого визуала (`4defb9839bc8c4fb858223596651cbac2227a196:docs/design/1132-beta4-ui/2026-10-30/`) — он не входит в материал ревью ТЗ (материал — тело issue) и физически отсутствует в текущем dev-дереве; его целостность/доступность — предмет AC1 на этапе code-review.
- Не запускались build/test/golden/gate:small — не требуются на этапе `spec`, код не менялся.
- Не оценивалась фактическая реализация (её нет); не проверялась точность 44 px/10 px в текущем коде панели — это утверждение ТЗ о целевом состоянии, а не о текущем, проверяется на code-review.
- Не проверялся release-ledger `docs/release-ledger/v1.82.0/1132.json` (ожидаемо отсутствует до S7) и авторская classification major/infra/stable-fix/line-fix по существу — это код-ревью пункт (REVIEWER.md «Объём гейтов»), на spec лишь констатируется, что ТЗ называет release-артефакты.

## Побочные находки

Побочных находок вне скоупа #1132 не обнаружено; `outside_findings` пуст.

## Вердикт

Один Medium **в скоупе** (M1), High нет. По правилам (`PROCESS.md` §2.4/§3 п.8): Medium в скоупе без High — **жёлтый** вердикт, возврат автору на правку текста ТЗ (устранить двусмысленность «summary/control overlay» в контракте UI-011), затем повторный цикл по дельте (§2.10).

Маршрут: `fix` (вне критерия `show`/`reclassify`; этап `spec`, трек `ask`).

Вердикт: жёлтый · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 1 → в задаче · Документ: docs/reviews/SPEC-REVIEW-1132-r1.md

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjY3ZTExNTAxZDk2NWUzMDk5OTBkODEzYjJkOTJlMTQwYThhNGY1ZTI3ZTdjZWM3ZjZlNTFkYTEyNjRiYmM1NWQiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiJhNzI0N2Q3YThlZmRkNjdkZTVkZmJjMDQ0YmUwZDE2YzJjZWM3MmRkNDYzMTQ2NmU1YWE2MWQwZDNjZGIxZDZhIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTMyLCJzdGFnZSI6InNwZWMiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiI3MmM2MzQ2NGFlODhjZDU3MTRlNjBhYjY4ZGEzZDA5YWUwNGQzOWI0IiwidHJlZSI6IjNkNDRiZDFhMGQ1MzE2ZTczZTk2Zjg3NzU2MWMwNjhkNDQzYzk1YTQiLCJib2R5RGlnZXN0IjoiZDU2NzM0NzU0ZmVlNGE5OGJjY2E1MzdlMjlhY2JmMGI3MDY4YzgzOTQ5OTk2NzBlMzIzY2Q1MWExZWMyY2Y5MyIsInByb2R1Y2VyUnVuIjoiNDA5Njk3OTY1MTQiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjY4ZDdmZDgwN2JhMWVkZTg2MDRiYmYyOGM1ZTU5NGQ3MGU1ODdkMDBlNTJlY2I1MWY4NDRmNTRiNDczYTMwMGUiLCJ2ZXJkaWN0RGlnZXN0IjoiMmI3ZTIyZTAyNzQ0ZTNhMjQxNDJiNDMzYjhlMGUwMTA4ODRkMjhmMGEyNjdmZjY0ZjBmNjM1ZjU0YjRlYzM3NCIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI2ZTFlMjQzZmRmMzdjNWNmZDI3MDI0MmU1MjIzNDkwMDczOWViYjUxYjAyNzkxNWY2NTBmYWFjMDM1ZmM1NDc5IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NTEwNjMxNjM4LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTMyI2lzc3VlY29tbWVudC02NTEwNjMxNjM4IiwiYm9keURpZ2VzdCI6IjUzMjM4NmRlZDQ0NGQyN2ZlMzc0YWViZDZjMTBmYWJhZDRiZmRkNDA4OTAyNWZlY2Q0ZjZiMzhlMmZiODY4MTUifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `72c63464ae88` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `3d44bd1a0d5316e73e96f877561c068d443c95a4`
  ```
  git log --all --format='%H %T' | grep 3d44bd1a0d53
  ```
- Тело issue: `d56734754fee4a98bcca537e29acbf0b7068c8394999670e323cd51a1ec2cf93`
- Вердикт конвейера: `yellow` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NDIsIm91dHB1dF90b2tlbnMiOjMwOTAzLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEwNzAyMywiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjE1ODc1NTAsImNvc3RVc2RFc3RpbWF0ZSI6MS4wNTQ3MTZ9XSwidHVybnMiOjM2LCJkdXJhdGlvbk1zIjozOTkyODgsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjA1NDcxNiwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=42 output_tokens=30903 cache_creation_input_tokens=107023 cache_read_input_tokens=1587550 num_turns=36 -->
