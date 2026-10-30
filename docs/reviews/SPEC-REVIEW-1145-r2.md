# SPEC-REVIEW-1145-r2

Issue: #1145 — «Мелкие дефекты оформления из аудита UI Kit (#1131): 10 пунктов»
Этап: spec (ревью ТЗ, трек `ask`, PROCESS.md §2.4)
Заход: r2 · блокирующих циклов 1/4
Материал: тело issue, `bodyDigest 59e6e4c0962b813cfdfb491b568b9a18577d28699b497d53db788c163ede0498`,
дерево/коммит `3d9bc8364013f0f8ab297de07e528b3761dd6c1e` (рабочая копия на нём).

## Материал раунда и статус r1

Формальный `docs/reviews/SPEC-REVIEW-1145-r1.md` в репозитории отсутствует —
это проверено (`Glob docs/reviews/*1145*` → ничего). Это не пробел ревью: по
комментариям issue штатный раунд r1 довёл модель до запечатанного жёлтого
вердикта (H0/M1, `issuecomment-6513711704`, тело `bodyDigest
b020a5defd09e9216c8cc1332fa2d7971056258920e0f7176a13d76cf4b07bd4`), но шаг
публикации дважды отказал (`published finding missing, changed or foreign`,
затем повтор не вызвал модель: «this material already has a publication
record», `issuecomment-6513714528/6513729623`). Автор не принял старый
результат и не обошёл защиту (`issuecomment-6513773746`); владелец явно
разрешил один новый штатный запрос («Да, один повтор ревью ТЗ #1145»,
`issuecomment-6515329902`). Текущий заход — это и есть тот разрешённый повтор,
со свежим телом ТЗ (новый `bodyDigest`). Дерево/коммит материала не менялось
между r1 и r2.

## Как проверялось

Static-first: прочитаны обязательные источники роли (`docs/SCOPE.md`,
`AGENTS.md`, `docs/process/REVIEWER.md`), затем тело issue #1145 целиком
(раздел `## ТЗ` и предшествующие разделы «Проблема»/«Аналитика» — для сценария
и фактической базы). Кодовый Validate на этапе spec не требуется и не
прогонялся (tsc/build/test/gate:small — не запускались, это не гейт данного
этапа). Единственный открытый технический вопрос этого захода — закрыта ли
находка M1 из r1 (пункт 9/AC5 ошибочно указывал `.wallthick-dlg` вне
`hp-dialog`) — проверен адресным чтением материала (не исполнением,
исполнимый oracle здесь не нужен — вопрос чисто о соответствии статических
ссылок коду):

- `src/houseplan-editor-runtime.ts:11125-11150` — `_renderPhysicalDialog()`
  рендерит `<hp-dialog ... data-kind="physical">` с телом, содержащим
  `<div class="row">` (строка 11144, без `slot="footer"`).
- `src/styles/dialogs.styles.ts:496-505` — правило `hp-dialog .row` не
  ограничено `[slot='footer']`, значит затрагивает и этот `.row` в теле
  physical-диалога.
- `src/houseplan-editor-runtime.ts:5829` и `src/styles/editor-dialogs.styles.ts:28-58` —
  `.wallthick-dlg` действительно отдельный плавающий попап (`position:
  absolute`, свой `z-index`) вне `<hp-dialog>`, с собственным
  `.wallthick-dlg .row` (строка 45), не содержащим padding/border-top/
  justify-content из правила 496-505. Он не подвержен дефекту — вывод r1
  подтверждён.

Дополнительно точечно перепроверены факты, не изменившиеся между r1 и r2 (как
представительная выборка, а не полный повторный аудит всех исходных пунктов —
дельта их не затрагивала):

- `.btn.primary` — нет ни одного совпадения в `src/**` (grep по всему
  дереву) — пункт 1/AC1 подтверждён.
- `--sp-8` — объявлен только `--sp-1…--sp-6` в `src/styles/base.styles.ts:19-24`;
  используется, но не определён в `chrome.styles.ts:67` и повторно в
  `editor-dialogs.styles.ts:761` (второе использование — уже заведённая F1 из
  r1, issue #1151, в этот раз не дублируется) — пункт 2/AC1 подтверждён.
- `hpf-disclosure-compact` — нет совпадений в `src/**` — пункт 7/AC1
  подтверждён.
- `stairs-editor.ts:628` и `optimize-plans-dialog.ts:539` — оба действительно
  `<div class="row">` без `slot="footer"` в теле соответствующих диалогов —
  подтверждают оставшуюся часть AC5.
- Целевые golden-сцены AC/плана тестов (`decor-color-popover-desktop-en`,
  `furniture-variants-light`, `furniture-variants-dark`,
  `optimize-preflight-dialog-dark-en`, `optimize-preflight-dialog-light-ru`) —
  все пять существуют в `demo/golden/matrix.mjs`.
- Названные в AC5 существующие smoke (`demo/smoke_stairs.mjs`,
  `demo/smoke_optimize_context.mjs`) существуют; планируемый новый
  `demo/smoke_ui_polish_1145.mjs` ещё не создан (ожидаемо для spec-этапа) и
  следует существующему соглашению об именовании (`smoke_ui_polish_963/976/1132.mjs`).

## Закрытие раунда r1

| Находка | Чем закрыта | Где это видно |
|---|---|---|
| M1 (Medium, в скоупе): пункт 9/AC5 ошибочно включал плавающий попап `.wallthick-dlg` (ссылки 5831/5842) в список поверхностей, страдающих от бесскопового `hp-dialog .row`, хотя у него уже есть собственное корректное `.wallthick-dlg .row`, и требуемое AC5 доказательство «до/после» там не на чем строить | Текст пункта 9 дополнен предложением «Уточнение после ревью: прежние ссылки 5831/5842 указывали на `.wallthick-dlg` вне `hp-dialog`; этот плавающий попап дефекту footer-каскада не подвержен и исправлений здесь не требует», ссылки заменены на реальный `_renderPhysicalDialog()`/`hp-dialog[data-kind="physical"]` (`houseplan-editor-runtime.ts:11125–11149`); AC5 получил симметричное уточнение «`.wallthick-dlg` вне hp-dialog — только неизменный соседний контроль, от него не требуется несуществующее исправление «до/после»» | Тело issue, разделы «Проблема» п.9 и «Критерии приёмки» AC5 (`bodyDigest 59e6e4c0…`); подтверждено независимым чтением `src/houseplan-editor-runtime.ts:5829,11125-11150` и `src/styles/editor-dialogs.styles.ts:28-58` (см. «Как проверялось») |

Исправление точное: новый сценарий (`hp-dialog[data-kind="physical"]`,
перегородка/колонна) реально существует, реально содержит незаскоупленный
`.row`, и реально подвержен дефекту пункта 9 — AC5 теперь доказуем.

## Унаследовано из r1

Девять из десяти исходных пунктов (1–8, 10 по нумерации «Проблема») и
покрывающие их AC1–AC4, AC6, а также часть AC5 про `stairs-editor.ts`/
`optimize-plans-dialog.ts` приняты из r1 без полного повторного построчного
аудита — тело ТЗ для них байт-в-байт не менялось между r1 и r2, дельта
затронула только пункт 9/AC5. Базис — запечатанный вывод r1
(`issuecomment-6513711704`): «Остальные девять пунктов и их AC1–AC6 проверены
чтением исходников на материале 3d9bc8364 и подтверждены фактически точными,
однозначными и снабжены способом доказательства». В этом заходе я
самостоятельно перепроверил представительную выборку этих фактов (см. раздел
«Как проверялось» — primary/`--sp-8`/disclosure-compact/footer-строки лестницы
и оптимизации/golden-сцены) и расхождений не нашёл; файлы `led-strip-editor.ts`,
`radar-section.ts`/`radar-setup.ts`, `houseplan-card.ts`/`vacuum-maps-section.ts`
(`ghostbtn`), `marker-alert-editor.styles.ts`, `hp-color-opacity.ts`,
`space-card.ts`, `summary-panel-style.ts`, `dialogs.styles.ts:350-353,462-470`,
`editor-dialogs.styles.ts:322,451` повторно построчно не читал — эта часть
принята как унаследованная из r1 (материал дерева/коммита тот же, текст пунктов
не менялся).

Также унаследован статус побочной находки r1: F1 (второе использование
несуществующего `--sp-8` в `.device-inbox-empty`, `editor-dialogs.styles.ts:761`)
уже заведено как [#1151](https://github.com/Matysh/houseplan-card/issues/1151);
новой находкой в этом раунде не поднимаю.

## Проверка обязательных разделов и AC (§7.1)

Все обязательные разделы присутствуют: сценарий · что человек увидит до/после ·
проблема · скоуп и не-скоуп · контракт поведения · UX/модель данных/миграция/
i18n/производительность · критерии приёмки AC1–AC6 с доказательством · план
автотестов и release-артефакты · риски и откат. Блок «принято предположительно,
поменять свободно» присутствует и закрывает не-продуктовую неоднозначность
(конкретные имена классов, распределение правил, шаг отступов farhint) —
корректное использование механизма §7.1, доводить до владельца эти пункты не
требовалось.

Каждый AC называет способ доказательства:

- **AC1** (пункты 1–3, 7) — визуальные кадры до/после + чтение адресного диффа/
  документа. Детерминирован, не защитный AC в строгом смысле (переключение
  модификатора класса) — таблица «чем краснеет» не обязательна, доказательство
  достаточно.
- **AC2** (пункт 4, тема опасных действий + мебель) — вычисленные цвета/
  контраст в light/dark/custom + явная проверка с другим accent/error,
  «исключающая случайное совпадение литералов» — это и есть «чем краснеет» для
  защитного по сути AC (иначе literal-цвет мог бы случайно совпасть с текущим
  accent/error и замаскировать баг).
- **AC3** (пункт 5, disabled-гард) — защитный AC; «чем краснеет» — обычный
  negative case на неизменённой реализации: клик/Enter/Space по нативно
  отключённой кнопке не должен увеличивать счётчик действия реального
  компонента, в отличие от enabled-соседа. Способ назван прямо в тексте AC3.
- **AC4** (пункт 6, размеры ≥44px) — защитный AC; «чем краснеет» назван явно:
  «обычные отрицательные данные oracle (43 px/overflow) проверяют отказ без
  патча реализации» — это именно обычный negative-input case на существующих
  проверках, не мутант.
- **AC5** (пункт 9/8, скоуп футера) — защитный/инвариантный AC. Отдельной
  фразы «чем краснеет» нет построчно в самом AC5, но общий план автотестов
  требует «снять красный свидетель на исходном dev по симптомам» до кода — то
  есть до-кадр на текущем (ещё не исправленном) `hp-dialog[data-kind="physical"]`
  обязан показать протекший footer-вид тела диалога, что и есть красный
  свидетель для этого инварианта. Это покрывает требование по существу,
  отдельной графы не завожу находкой.
- **AC6** (пункт 10/9, touch hover) — аналогично AC5: красный свидетель на
  исходном dev (залипший hover после tap) обязателен тем же общим пунктом
  плана тестов.

Мелкое наблюдение не как находка: нумерация пунктов в разделе «Проблема»
(10 пунктов) и в «Скоуп и контракт поведения» (9 пунктов, т.к. п.8 «мебель»
слит в п.4 «тема опасных действий») расходится между собой. Текстуально это
не создаёт неоднозначности — каждый AC называет содержание пункта, а не только
номер, и перекрёстные ссылки (AC2→«пункт 4», AC5→«пункт 8»/«Футер») совпадают
с правильным разделом по смыслу. Снимаю это сам, без находки.

## Что проверено и корректно

- Факт закрытия M1 — подтверждён независимым чтением кода (см. выше).
- Выборочная перепроверка фактов, не затронутых дельтой — без расхождений.
- Обязательные разделы ТЗ присутствуют, AC1–AC6 однозначны, каждый называет
  способ доказательства; защитные AC (AC3–AC6) имеют явный или покрытый общим
  пунктом плана тестов способ «чем краснеет».
- Скоуп/не-скоуп чётко исключают пакеты #1146–#1150, геометрию, данные, права,
  i18n — согласуется с `docs/SCOPE.md` (полировка существующих job J4/J6, без
  нового функционала).
- Ссылки на golden-сцены и существующие smoke в плане тестов реальны.
- Трек `ask` обоснован (несколько поверхностей, общий каскад, touch) — решение
  владельца зафиксировано трейлером в комментарии.

## Чего не проверял

- Полный построчный аудит всех десяти исходных пунктов — только
  представительная выборка плюс делта (пункт 9/AC5); остальное унаследовано
  из r1 как не изменившееся.
- Исполнение какого-либо кода/смоков — на этапе spec реализации ещё нет,
  `demo/smoke_ui_polish_1145.mjs` не существует.
- Фактические измерения контраста/размеров из пунктов 4 и 6 — это задача
  будущего браузерного свидетеля на этапе кода, не ревью ТЗ.

## Гейты

| Гейт | Прогнан | Почему |
|---|---|---|
| tsc/build/npm test/`gate:small` | Нет | Этап spec, кодовый Validate не требуется (явно оговорено в задаче) |
| `run_check` (исполнимый oracle) | Нет | Открытый вопрос этого захода (M1/wallthick) — о соответствии статических ссылок коду, решается чтением, не исполнением |
| Адресное чтение материала (Grep/Read) | Да | Проверка M1 и выборочная сверка фактов пунктов 1,2,7,9 плюс golden/smoke-ссылок |

## Вердикт

High: 0. Medium: 0 (M1 из r1 закрыта текстом и подтверждена чтением; новых
находок не обнаружено). ТЗ полно, однозначно, доказуемо.

Маршрут: `fix` (трек `ask`, задано политикой тревьюера для non-show этапов и
не относится к `reclassify`).

Побочные находки: нет новых (F1 из r1 уже заведена как #1151, повторно не
поднимаю).

`route: fix`

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjJmYWExMjM0Njg1ZjUyYjQ0MGNhNWU0ZGU3YTc2Yjk4NmFiOTIyZjZiOTVlNDU0ZjRhOTExOWFiMWNmNzk1ZmMiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiIxOTI0YjZlYzg5M2ZjNTg1NTY4M2NjMmZjNzI4Njk4NzVhMWM4NWY2MDQ3NTRhZjFiYTJjYTUyZjVlYjRiMTVlIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTQ1LCJzdGFnZSI6InNwZWMiLCJyb3VuZCI6MiwibWF0ZXJpYWwiOiIzZDliYzgzNjQwMTNmMGY4YWIyOTdkZTA3ZTUyOGIzNzYxZGQ2YzFlIiwidHJlZSI6IjAwMDQ4MzlkYjUzYjNjNjUyNGRlZGE4OGRhZjExMDg2YmE5ZjllOWEiLCJib2R5RGlnZXN0IjoiNTllNmU0YzA5NjJiODEzY2ZkZmI0OTFiNTY4YjlhMTg1NzdkMjg2OTliNDk3ZDUzZGI3ODhjMTYzZWRlMDQ5OCIsInByb2R1Y2VyUnVuIjoiNDEwMDU2OTI2NzIiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjhiNzZjMWE0NDE2OTVlM2I5YjI2MGRmZWZiODNmN2FjYjhiZDI2ZDQxNDBiMzJhNmMyZTIxNTliMzVmMTFiZGUiLCJ2ZXJkaWN0RGlnZXN0IjoiMzZkNDcyMzhkNDM1Y2I1M2I0Y2ZiYmRkMDVkODBiZDY4ZmNjNGU2ZTUyMWQwNDNkNGEwMjMzMzA4Zjc5N2Y3NiIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJjM2RlNmQzNzk1Yjg5ZmMzN2NjNGU3NzRmYzc2YTEzZWFjZmM0OWU2ZTdiNjgyNTM5MDBlNjdmODA4NDY5NGU4IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NTE1NDM5NTkwLCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTQ1I2lzc3VlY29tbWVudC02NTE1NDM5NTkwIiwiYm9keURpZ2VzdCI6IjE3N2VhYzNkM2IwMWM4YTI4ZWM4ZmFjMTM5ZWEwNDIzYTFmYmUyODk0NDlmMzEyMmEyZmQzM2E1NDVjMTgwM2MifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `3d9bc8364013` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `0004839db53b3c6524deda88daf11086ba9f9e9a`
  ```
  git log --all --format='%H %T' | grep 0004839db53b
  ```
- Тело issue: `59e6e4c0962b813cfdfb491b568b9a18577d28699b497d53db788c163ede0498`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MzgsIm91dHB1dF90b2tlbnMiOjI1NzczLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjk4MjExLCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6MTI0MzAxNSwiY29zdFVzZEVzdGltYXRlIjowLjg5OTI1M31dLCJ0dXJucyI6MzMsImR1cmF0aW9uTXMiOjMyMDU0OSwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuODk5MjUzLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=38 output_tokens=25773 cache_creation_input_tokens=98211 cache_read_input_tokens=1243015 num_turns=33 -->
