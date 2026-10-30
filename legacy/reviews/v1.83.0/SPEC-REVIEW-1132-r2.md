# SPEC-REVIEW-1132-r2

Issue: #1132 — «Перенести согласованные UI-правки beta 4: панель, печать, значки и внешние экраны»
Трек: `ask` · Этап: `spec` · Заход: r2 · Материал: тело issue #1132, bodyDigest `e075217030bbe7d8e18d6c62fd4fcad7eb5d4c32c3c2942026d8b0f78dd892a8`, sha `5cf3bcd9d37de5f98aebe0ab70e18b35a2c0eb6d` (tree `6685f621116ae1202508cd6f866454480ab6e162`).

## Скоуп ревью

Предмет повторного раунда — дельта тела issue r1→r2 (PROCESS.md §2.10), а не ТЗ целиком. Дельта локальна: правка единственного Medium из SPEC-REVIEW-1132-r1 (M1 — двусмысленная формулировка «summary/control overlay» в контракте UI-011). Проверено, что дельта не задевает контракт других UI-ID, AC1–AC9, модель данных, i18n, план автотестов, риски, откат, release-артефакты — эти разделы приняты из r1 без повторной полной проверки (см. «Унаследовано из r1»).

## Как проверялось

1. Прочитаны обязательные источники роли заново: `docs/SCOPE.md`, `AGENTS.md`, `docs/process/REVIEWER.md` (раздел «Повторный раунд»); PROCESS.md §2.4/§2.10 открыты по ссылкам.
2. Прочитан блок «Материал раунда» и вердикт SPEC-REVIEW-1132-r1, сопоставлены три точки правки, заявленные автором (комментарий 2026-10-29T23:09:00Z): UI-011 в «Контракте поведения», AC7, «Технические решения принятые предположительно».
3. Текущее тело issue (все три раздела) прочитано целиком и построчно сверено со старой формулировкой r1.
4. Техническая точность новой формулировки проверена адресным чтением `src/summary-panel-runtime-loaded.ts` (без исполнения):
   - `renderControls(kiosk)` (строка 311) рендерит ровно `<div class="summary-control ${kiosk ? 'kiosk' : ''}">` (строка 315) с двумя кнопками — «настройка» (`summary-settings`, строка 318) и «переключатель сводки» (`summary-toggle` внутри, строка 322–327); именно этот узел адресуется селектором `.summary-control.kiosk` (используется как реальный querySelector в коде — строки 961, 991).
   - `.summary-overlay` (строка 261) — независимый узел, гейтится `effectiveShow` (строка 130, `this.host._externalScreen?.summary ?? this.local.show`), не связан с `kiosk`/`controls`.
   - `src/panel-route-kiosk.ts:38` подтверждает реальность URL-оверрайда `hpcontrols` → поле `controls`, упомянутого в ТЗ.
5. Сверена логическая непротиворечивость новой формулировки между тремя изменёнными местами (UI-011 / AC7 / «Технические решения») — термин `.summary-control.kiosk` и explicit-оговорка про `.summary-overlay` используются одинаково во всех трёх.
6. Единственный вопрос, не закрытый статическим чтением на r1 (двусмысленность формулировки), снят текстом: конкретных новых непокрытых технических вопросов на r2 не возникло, поэтому адресный `run_check`/negative-input case не потребовался.

## Гейты: что прогнано, что нет, почему

| Гейт | Статус | Причина |
| --- | --- | --- |
| `tsc`/build/`npm test`/`gate:small` | не прогонялся | Этап `spec`: кодовый Validate не требуется (REVIEWER.md «Ревью ТЗ»); код не менялся, дельта — только текст issue |
| Адресная проверка осуществимости (Grep/Read по изменённым утверждениям) | выполнена | `src/summary-panel-runtime-loaded.ts`, `src/panel-route-kiosk.ts` — см. «Как проверялось» п.4 |
| negative-input case / `run_check` | не потребовался | Непокрытых поведенческих вопросов нет; единственный вопрос r1 был вопросом формулировки текста, закрыт чтением |
| `specFormatErrors(body,'ask')` | PASS (по данным автора, комментарий 2026-10-29T23:09:00Z) | Не формальная семантическая проверка; обязательные разделы §7.1 по-прежнему все присутствуют (проверено в r1, дельта их не убирала) |

## Закрытие раунда r1

| Находка | Чем закрыта | Где это видно |
| --- | --- | --- |
| M1 (Medium, в скоупе): формулировка «summary/control overlay не рисуется» в UI-011 допускала прочтение «скрыть и саму сводку HA-состояний» | Формулировка заменена во всех трёх местах на явное «не рендерятся **только кнопки** `.summary-control.kiosk` (настройка и переключатель сводки)»; явная оговорка «Сама `.summary-overlay` … остаётся видимой/скрытой ровно по прежним правилам … её рендеринг и данные не подавляются этой правкой» добавлена отдельным предложением | Тело issue, раздел «Контракт поведения» → «Внешние экраны UI-011» (абзац, начинающийся «Опции «Кнопки поверх плана» больше нет…»); AC7 («старый profile/URL controls=true не создаёт `.summary-control.kiosk`/его keyboard targets; сама `.summary-overlay` и её summary preference работают как прежде»); раздел «Технические решения…» («Только вывод кнопок `.summary-control.kiosk` подавляется в render/policy… `.summary-overlay` не подавляется») |

Новая формулировка технически точна: `.summary-control.kiosk` — реальный, используемый в коде селектор (`src/summary-panel-runtime-loaded.ts:961,991`), а не изобретённый ad hoc; разделение узлов `.summary-control`/`.summary-overlay` и их независимые условия (`kiosk`/`controls` против `effectiveShow`) соответствуют актуальному dev-дереву. Двусмысленность устранена, новой не внесено.

## Находки

Новых находок на r2 нет. High: 0, Medium: 0.

## Что проверено и признано корректным

- Единственная заявленная правка (M1) действительно ограничена тремя названными местами; остальной текст ТЗ (UI-001…010, 012, контракт данных, i18n, AC1–AC9 кроме AC7, план автотестов/гейтов, риски, откат, release-артефакты) не изменился — построчно сверено с телом r1, расхождений вне заявленной дельты не найдено.
- Новая терминология `.summary-control.kiosk` / `.summary-overlay` однозначна, не допускает повторного двойного толкования и согласована между всеми тремя изменёнными фрагментами.
- Формулировка подтверждена реальным кодом (`src/summary-panel-runtime-loaded.ts`, `src/panel-route-kiosk.ts`), а не выдумана заново: селектор, его условия рендера и независимость от `.summary-overlay` существуют в dev-дереве ровно так, как теперь описывает ТЗ.
- AC7 и «Технические решения» после правки взаимно непротиворечивы и используют единый термин, что устраняет риск, названный в r1 («разработчик может скрыть саму сводку вне скоупа задачи»).
- Открытых продуктовых или технических вопросов после правки не осталось; автор не выходил к владельцу — обоснованно, т.к. вопрос был чисто формулировочным.

## Унаследовано из r1

Следующее принято без повторной проверки — оценено как корректное в SPEC-REVIEW-1132-r1 (материал: тело issue, bodyDigest `d56734754fee4a98bcca537e29acbf0b7068c8394999670e323cd51a1ec2cf93`, прочитан dev `72c63464ae88cd5714e60ab68da3d09ae04d39b4`), дельта r2 этих разделов не касалась:

- Полнота обязательных разделов §7.1 (сценарий, что увидит человек, проблема/основание, скоуп/не-скоуп, контракт поведения UI-001…010/012, UX и визуальная приёмка, модель данных/миграция, i18n, AC1–AC9 кроме исправленного AC7, план автотестов/гейтов, производительность/риски, откат, файлы и release-артефакты).
- Соответствие технических утверждений реальному dev-дереву для `panel-header-flow.ts`, `panel-header-menu.ts`, `styles/panel-header.styles.ts`, `pdf/hp-pdf-dialog.ts`, `editors/external-screens.ts`, `external-screens.ts`.
- Сверка с канонами: `docs/DEVICE-PRESENTATION.md` (строки 66–67, реальность UI-010 дефекта), `docs/CONFIG-COMPATIBILITY.md` (строки 1801–1819, совместимость поля `controls`), `docs/USER-GUIDE.ru.md` (строки 3785/3789, терминология «кнопки поверх плана»/`hpcontrols`), `docs/PDF-EXPORT.md` (осуществимость UI-006).
- Отсутствие design-пакета `4defb9839bc8c4fb858223596651cbac2227a196:docs/design/1132-beta4-ui/2026-10-30/` в dev-дереве — не находка этапа spec (материал ревью ТЗ — тело issue, а не ветка визуала); проверка пакета относится к AC1 на code-review.
- Явный и адресный не-скоуп (геометрия, алгоритмы света/Zigbee, activity/alert-приоритет, SVG/PDF scene/writer, формат внешних профилей, порог 1024 px Properties sidebar, лабораторные polling/MutationObserver/CSS-mask).
- i18n-решение (новых строк не требуется, условное удаление `screens.controls`/`screens.controls_help`), классификация release (предварительно stable-fix относительно v1.82.0) — авторское суждение, корректно обосновано и не входящее в предмет этой дельты.
- Отсутствие открытых продуктовых вопросов к владельцу.

## Чего не проверял

- Design-пакет закреплённого визуала (`4defb9839bc8c4fb858223596651cbac2227a196:docs/design/1132-beta4-ui/2026-10-30/`) — как и в r1, не входит в материал ревью ТЗ и физически отсутствует в dev-дереве; предмет AC1 на code-review.
- Build/test/golden/gate:small — не требуются на этапе `spec`, код не менялся ни в r1, ни в r2.
- Фактическая реализация (её нет); точность 44 px/10 px, поведение `renderControls` после будущей правки кода (сейчас код гейтит кнопки по `kiosk && (mode!=='view' || controls===false)`, то есть ещё не реализует «всегда скрыты в киоске» — это ожидаемо, т.к. ТЗ описывает целевое состояние для code-review, а не текущий код).
- `docs/release-ledger/v1.82.0/1132.json` — ожидаемо отсутствует до S7, не предмет spec-review.

## Побочные находки

Побочных находок вне скоупа #1132 не обнаружено. `outside_findings` пуст. Маршрут публикации — `mode=issues` (политика `HP_REVIEW_OUTSIDE_FINDINGS_FILE_ISSUES`), новых Medium вне скоупа для передачи нет.

## Вердикт

M1 из r1 закрыт точной и технически подтверждённой формулировкой; новых High/Medium не найдено. По правилам (`PROCESS.md` §2.4/§3 п.8, §2.10): **зелёный** вердикт.

Маршрут: `fix` (директивно для этапа `spec`/трека `ask`, #726).

Вердикт: зелёный · заход r2 · блокирующих циклов 1/4 · High: 0 · Medium: 0 · Документ: docs/reviews/SPEC-REVIEW-1132-r2.md

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjA2YTMxM2JlZTNhNjk3NDExN2EwMTYyZGE5MzgyOGIwNDI2NTE3ODJiNzdlZGI2NDdlNDk2YmZmYzk3Nzk4NGMiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiIzNzcxOThmY2JhYmQzYjJhNjkyMDYwNmUzM2IyZTQ5M2NjZTUyOWU3ZWIwZDE0N2ZiODA0NWU2MmU2YjczNDRmIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTMyLCJzdGFnZSI6InNwZWMiLCJyb3VuZCI6MiwibWF0ZXJpYWwiOiI1Y2YzYmNkOWQzN2RlNWY5OGFlYmUwYWI3MGUxOGIzNWEyYzBlYjZkIiwidHJlZSI6IjY2ODVmNjIxMTE2YWUxMjAyNTA4Y2Q2Zjg2NjQ1NDQ4MGFiNmUxNjIiLCJib2R5RGlnZXN0IjoiZTA3NTIxNzAzMGJiZTdkOGUxOGQ2YzYyZmQ0ZmNhZDdlYjVkNGMzMmMzYzI5NDIwMjZkOGIwZjc4ZGQ4OTJhOCIsInByb2R1Y2VyUnVuIjoiNDA5NzExNDIwMzAiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6ImNhODM4YzI2NjY1YzcwOTdmZmZmNmE1YTQzNTcwN2M2ZGZmNjQzMjhkNjkxNzNhNjY3YWUzNWYxZGMzMTVhOWIiLCJ2ZXJkaWN0RGlnZXN0IjoiMDEzMGEwNGMyODU1NDRkNTUzYzkzZDZmODc0NTUzOTgwZGJhMzQ3YWE0N2FjNjhmOTNiODJhYzViYmI1OGI1ZCIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJkZmI0OTk1NDhiMjk5ZWY2ODFhNDM3ZDk0NmVhYTY5ZmM4ODlkMTZmN2EzZDkwMjBkMmNjMDQ1MTkyMmQxNGViIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NTEwNzMxNjY1LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTMyI2lzc3VlY29tbWVudC02NTEwNzMxNjY1IiwiYm9keURpZ2VzdCI6ImVmNGM3OTlkOWJlMDE3MDNkY2IzYzk1NTQ4NGU4NDk5OGZjZjcwYTFiNjBlYTYyNTE3NzU5MGI5NWMyMjJiMjYifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `5cf3bcd9d37d` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `6685f621116ae1202508cd6f866454480ab6e162`
  ```
  git log --all --format='%H %T' | grep 6685f621116a
  ```
- Тело issue: `e075217030bbe7d8e18d6c62fd4fcad7eb5d4c32c3c2942026d8b0f78dd892a8`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MjQsIm91dHB1dF90b2tlbnMiOjEwODkwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjc4NjY4LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6NjA4MTk0LCJjb3N0VXNkRXN0aW1hdGUiOjAuNTQ1MjU4OH1dLCJ0dXJucyI6MTcsImR1cmF0aW9uTXMiOjE0MzM5NiwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuNTQ1MjU4OCwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=24 output_tokens=10890 cache_creation_input_tokens=78668 cache_read_input_tokens=608194 num_turns=17 -->
