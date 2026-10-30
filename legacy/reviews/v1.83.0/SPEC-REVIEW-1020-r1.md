# SPEC-REVIEW-1020-r1

## Материал

- Issue: #1020, этап `spec`, трек `track:ask`, заход r1.
- ТЗ: тело issue #1020, раздел `## ТЗ`, редакция 1 · 26.10.2026.
  `bodyDigest` (REVIEW_CONTEXT): `077235dabb891cd777c0537cb8d00a79d8446783d8d0d0b4e3384c55da0dd9cf`.
- Основание по коду в ТЗ: принятый `dev` `98baf6d77e28fdc0fbe53d75a715cd4b9d9ba82f`.
  Продуктовый код этой задачей не менялся (спек-стадия).

## Скоуп

J4 («from zero to a working plan») — подсказка о конвертере Sweet Home 3D /
Easy Floorplan на пустом экране и в диалоге «Создать пространства из этажей
HA», перевод этого диалога на общий UI Kit, один общий источник URL/списка
форматов для обоих мест вывода. Не затрагивает сам конвертер, импорт,
onboarding-флаги, общие настройки (#948) и инфраструктурную проблему #1083.

## Как проверялось

Этап `spec`: оценивается ТЗ, кодовый Validate не требуется (`docs/process/REVIEWER.md`
§«Ревью ТЗ»). Выполнено:

1. Прочитаны обязательные источники роли: `docs/SCOPE.md`, `AGENTS.md`,
   `docs/process/REVIEWER.md`, нужные секции `PROCESS.md` (§2.3–2.5, §7.1).
2. Сверены обязательные разделы ТЗ (§7.1): сценарий, что человек увидит до и
   после, проблема, скоуп/не-скоуп, контракт поведения, UX и touch, модель
   данных и миграция, i18n, критерии приёмки AC1–AC7 со способом доказательства,
   план автотестов, риски, откат, release-артефакты — все присутствуют.
3. Проверена осуществимость конкретных технических утверждений ТЗ адресным
   чтением текущего материала (не гейтами — для них на этом этапе нет
   непокрытого вопроса, оправдывающего прогон):
   - `src/houseplan-onboarding-runtime.ts:355-388` — диалог
     «Создать пространства из этажей HA» (`_renderImportDialog`) существует,
     использует `<hp-dialog>`, список этажей с checkbox, footer с
     «Начать с нуля»/`import.start` — контракт п.3–4 описывает реальный, а не
     выдуманный узел.
   - `src/houseplan-card.ts:4136-4144` — `_syncEmptySpaceState` уже оперирует
     ровно `spaces.length === 0`, терминология контракта п.1 совпадает с кодом.
   - `src/houseplan-card.ts:10889-10922` — пустой экран (`empty.no_spaces`,
     кнопки `btn.add_space`/`empty.import_backup`) подтверждает существование
     точки крепления абзаца из контракта п.2 — и одновременно вскрывает гейт
     (см. находку ниже).
   - `src/houseplan-card.ts:1072-1080` — `_canManageConfiguration`/`_serverStorage`
     — ACL-гейт, формирующий ветки пустого экрана.
   - `src/styles/form-kit.styles.ts:1-40` и `src/editors/general-settings-dialog.ts:285-287`
     — общий параметризованный CSS-набор (`prefix: 'hpf'`) уже используется двумя
     потребителями (сводная панель и общие настройки) — подтверждает
     осуществимость «общий form-kit/shell/link styling» и «без зависимости
     onboarding→весь editor» (контракт п.3, п.9, раздел «Модули»).
   - `src/i18n/settings/ru.json:183-185` — существующие `gs.converter_description/
     link/result` подтверждены: текущий список форматов зашит внутри
     локализованного предложения (а не вынесен в данные) — именно тот паттерн
     дублирования, который ТЗ требует не повторять для двух новых абзацев
     (контракт п.6–7).
   - `docs/release-ledger/cycle.json` — `baseStable: v1.82.0` подтверждает
     корректность ссылки «относительно v1.82.0» в разделе «Release-артефакты».
   - `src/i18n/settings/{en,ru,fr,de}.json` — подтверждают «все четыре языка».
4. Гейты кода (`tsc`, `build`, `npm test`, `gate:small`, golden) не
   запускались: отсутствие CI на SHA документа ревью не является причиной их
   запускать на этапе `spec`, а конкретный непокрытый вопрос, который
   оправдал бы адресный прогон, не найден — обнаруженная находка (ниже)
   разбирается чтением контракта/кода, без исполнения.

## Находки

### M1 — Medium, в скоупе задачи: поведение абзаца-подсказки не описано для пустого экрана без кнопок

**Контракт/AC:** п.1–2 контракта поведения, AC1 («на пустом экране... виден
согласованный абзац в указанном месте»), AC2 (лайфциклы показа/скрытия по
`spaces.length`).

**Что не покрыто.** Контракт п.2 жёстко привязывает позицию абзаца к двум
существующим кнопкам: «Абзац помещён по центру под существующими «Добавить
пространство» и «Импорт резервной копии»». Но эти кнопки рендерятся только в
одной из веток пустого экрана:

```
src/houseplan-card.ts:10906-10922
${this._serverStorage && this._canManageConfiguration
  ? html`...btn.add_space...empty.import_backup...`      // кнопки есть
  : html`<p class="muted">${this._t(this._serverStorage ? 'empty.read_only' : 'empty.install')}</p>`}
                                                           // кнопок нет
```

`_canManageConfiguration` (src/houseplan-card.ts:1072-1075) — ACL-гейт
writer/non-writer; `_serverStorage` (строки 900, 3387, 4541, 4587) — признак
того, что конфигурация ещё не на server storage. Иначе говоря, абзац без
кнопок-якоря встречается не в экзотическом углу, а ровно в двух реальных
путях:

- **household-viewer** открывает пустой план (SCOPE.md: View — продукт для
  household/guest персон, не только для admin) — видит `empty.read_only` без
  единой кнопки действия;
- **admin без server storage** (например, свежая/ещё не мигрированная
  установка) видит `empty.install` — тоже без кнопок, причём это один из
  самых вероятных входов именно в сценарий J4 «from zero», который ТЗ и
  обслуживает.

Контракт не говорит, должен ли абзац в этих ветках: (a) не показываться
вовсе, (b) показываться под `empty.read_only`/`empty.install` без привязки к
кнопкам, или (c) требовать другого якоря. AC1/AC2 требуют показа «на пустом
экране» безусловно и не оговаривают эту ветку. Два разумных прочтения дают
разный пользовательский результат (подсказка видна non-writer-зрителю или
нет; расположена под текстом вместо кнопок или нет) — это продуктовая
неоднозначность, которую реализация не может разрешить сама, не изобретая
поведение.

**Серьёзность:** Medium, в скоупе: это та же поверхность (пустой экран),
которую контракт п.1–2 и AC1/AC2 этой же задачи уже описывают — не отдельная
фича. Без исправления разные реализации дадут разное видимое поведение для
household/guest персон и для до-миграционных установок.

**Чем закрывается:** одна строка в контракте п.1 или п.2, явно описывающая
ветку `!(this._serverStorage && this._canManageConfiguration)` — показывать
абзац под read_only/install-сообщением, не показывать вовсе, либо
переформулировать п.2 так, чтобы крепление не предполагало наличие кнопок.

## Что проверено и признано корректным

- Все обязательные разделы §7.1 присутствуют, ни один не пропущен.
- Контракт п.1 («spaces.length=0, не флаг первого визита») точно совпадает с
  существующей терминологией кода (`_syncEmptySpaceState`), однозначен и
  проверяем.
- Контракт п.3 (отступы/размеры абзаца в диалоге этажей: `gap20px`,
  `font13px/line-height1.6`) дословно совпадает с согласованным UI Lab
  текстом из раздела «Согласованный вариант UI Lab» — числа не расходятся
  внутри самого ТЗ.
- AC4 (общий источник URL/форматов) и его формулировка «дополнительный
  элемент во входном fixture formatter виден в обоих выводах» — однозначный,
  легко автоматизируемый критерий; направление (не дублировать данные
  построчно в двух локалях) подкреплено реальным прецедентом дублирования в
  текущем `gs.converter_description` (см. выше) и реальным прецедентом общего
  параметризованного источника (`form-kit.styles.ts`) в этой же кодовой базе.
- AC5 (клик по ссылке не закрывает диалог/не запускает импорт/не делает
  prefetch) и контракт п.5/п.7 однозначно формулируют защитное поведение и
  называют способ доказательства (smoke перехвата popup/network/config) —
  этого достаточно для DoR на этапе `spec`; таблица «AC · чем доказан · чем
  краснеет» — требование код-ревью (§2.7), не этого этапа.
- Контракт п.9 и раздел «Модули» о сохранении lazy-границы onboarding
  технически осуществимы: `src/houseplan-onboarding-runtime.ts` уже не
  импортирует `houseplan-editor-runtime` ничем, кроме type-only импорта
  (строка 13), и в кодовой базе есть прецедент общего, параметризованного по
  потребителям CSS-модуля (`form-kit.styles.ts`, уже используемого
  `general-settings-dialog.ts` и сводной панелью) — предлагаемый «общий
  converter-info source» не требует нового архитектурного решения.
- i18n-раздел задаёт точные ключи (`converter_hint.before_link/link/
  after_link/supported_formats`) и явно требует структурного узла-ссылки, а
  не поиска слова в строке — устраняет типичный источник хрупкости такого
  рода подсказок.
- Ссылка `release-ledger` на `v1.82.0` как предыдущий stable подтверждена
  `docs/release-ledger/cycle.json` (`baseStable: v1.82.0`).
- Раздел «Принято предположительно, поменять свободно» корректно выносит
  непродуктовые технические решения (имя модуля/ключей) на усмотрение автора
  реализации, не требуя решения владельца — в соответствии с §7.1.
- Открытых продуктовых вопросов, вынесенных на владельца, в тексте нет; один
  реальный технический пробел (M1) разобран и решён по существу в этом
  вердикте, а не передан дальше.

## Чего не проверял

- Визуальное совпадение с локальными кадрами UI Lab
  (`first-space-floors-preview-1020.png`, `first-space-empty-preview-1020.png`)
  — кадры приватные и локальные по тексту самого ТЗ, пиксельное сравнение вне
  досягаемости этого ревью; само ТЗ честно фиксирует, что кадры «в этой
  сессии не открывались» и требует найти их точный набор перед кодом — это
  требование к автору реализации, не пробел ревью.
- Полное поведение всех четырёх языков, светлой/тёмной темы, узкого экрана и
  reduced motion — явно не проверялось в UI Lab и не является задачей
  спек-ревью; эти пункты закрыты адресными smoke/golden на этапе реализации
  (AC6).
- Доступность внешнего сайта `houseplan.tech/convert/` — вне скоупа (см.
  #1083 в «Связях» и аналитику S2→S3).
- Любые гейты кода (`tsc`, `build`, `gate:small`, golden, pytest) — не
  запускались: на этапе `spec` кодовый Validate не требуется, а найденный
  пробел (M1) разбирается чтением, не исполнением.

## Маршрут побочных находок

Доверенный снимок политики: `mode=issues`. Других находок, кроме M1
(Medium, в скоупе), не обнаружено — outside_findings пуст, публикация issue
не требуется.

## Вердикт

Вердикт: жёлтый · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 1 → в задаче
Документ: docs/reviews/SPEC-REVIEW-1020-r1.md

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6ImRjYTNmNGNlNzI4NDAwYmU5ZGE4YmI4MWU4YTQ3MmFjMjVjMDUzMWVmYmFkNWUzNTkxZmQyYjVlMGIxZDMwMTciLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiJkNDliYzM4YjJkY2QyZDBhZDZmZTNlNDI3ZDM5YzdlMmZjNzkzZjdkMDMxMjZkZTBhNjVhMjRkNzU3NmVlYzZlIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDIwLCJzdGFnZSI6InNwZWMiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiI1Y2ZhOTNiMzIzMDBmODZhYmJhOTk1OTI1NTA5ZjA2MTE4ZTA5OTQ1IiwidHJlZSI6IjBlN2U0NGUyYTY2NTNhYWM1YTI5ZTY0ZGQxODg0MjQzZjI4ODVjZTQiLCJib2R5RGlnZXN0IjoiMDc3MjM1ZGFiYjg5MWNkNzc3YzA1MzdjYjhkMDBhNzlkODQ0Njc4M2Q4ZDBkMGI0ZTMzODRjNTVkYTBkZDljZiIsInByb2R1Y2VyUnVuIjoiNDAyNTI1MjM4NTciLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6ImZmNGZhNTY3ZGFmMjBjYjljOTk1NmFmMzc5Mjk5NjExMjNmM2ViMGUyOGVlMDNhZWExYWM0ZTNhNzkzMDIyN2YiLCJ2ZXJkaWN0RGlnZXN0IjoiZDc0YjcyMDgyMDJhY2RiODNhOWZhOTQxNmRlZjUwYmMxM2EwZWNiMWE0NzBmNzdlYWU4MGY5ZmYwYmFlN2MwYiIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJkNjZjNjM3MWZkZDRhY2Q0MzJiMDE5MGM3OTE0NGRiYzI2MDc0YWE1MDY5MmRjMDE3NThmNTRmNmI1YmFmOGQyIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDA2MDM5NDM2LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDIwI2lzc3VlY29tbWVudC02NDA2MDM5NDM2IiwiYm9keURpZ2VzdCI6IjcwZTM4M2FjZTNiMjI2OTVjMGFhYjBmYzIyMWEzYjc1NmZhNjU0ZmY3NDIwNjllZmM5NWFlZDAxYTdmNjgzMzMifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `5cfa93b32300` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `0e7e44e2a6653aac5a29e64dd1884243f2885ce4`
  ```
  git log --all --format='%H %T' | grep 0e7e44e2a665
  ```
- Тело issue: `077235dabb891cd777c0537cb8d00a79d8446783d8d0d0b4e3384c55da0dd9cf`
- Вердикт конвейера: `yellow` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NTAsIm91dHB1dF90b2tlbnMiOjI4ODE5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjkwNjU3LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6MTc3OTc2MCwiY29zdFVzZEVzdGltYXRlIjoxLjAwNjg3fV0sInR1cm5zIjozNiwiZHVyYXRpb25NcyI6MzUxMDQ3LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS4wMDY4NywiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=50 output_tokens=28819 cache_creation_input_tokens=90657 cache_read_input_tokens=1779760 num_turns=36 -->
