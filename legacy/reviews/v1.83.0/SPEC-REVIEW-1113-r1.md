# SPEC-REVIEW-1113-r1

Issue: #1113 · Этап: spec · Трек: ask · Заход: r1 · Блокирующих циклов: 0/4
Материал: тело issue #1113, раздел `## ТЗ` (редакция 1, 28.10.2026, основа dev
`0543e5796`). `bodyDigest` зафиксирован в REVIEW_CONTEXT.

## Скоуп ревью

Профили «Внешних экранов» для киоска основной страницы: серверное хранение
(`settings.external_screens`), раздел Общих настроек, URL-параметр
`hpprofile` и параметры переопределения, применение эффективных значений в
карточке (поворот, автолистание, возврат по простою, сводная панель, скрытые
устройства, размеры значков/текста, кнопки поверх плана), живое применение по
WebSocket, единый локальный ключ для путей основной страницы. Задача строится
на уже смерженном #1103 (киоск основной страницы).

Обслуживаемые работы из `docs/SCOPE.md`: J1 (живой обзор дома на внешнем
экране) и J3 (безопасные быстрые действия — кнопка поверх плана остаётся
удобством, не границей доступа, что ТЗ явно оговаривает). Решение владельца от
28.10.2026 (чат) зафиксировано в теле issue и ТЗ его не пересматривает.

## Как проверялось

Кодовый Validate на этапе spec не требуется (§8, REVIEWER.md «Ревью ТЗ»). Я
читал материал и проверял осуществимость/непротиворечивость ТЗ сопоставлением
с реальным кодом на SHA `0543e57962d38a02601d6cb0be04ab3ecc767099` —
инструментами Read/Grep, без изменения предмета ревью и без исполнения
тестов/билда (для spec это не требуется и не являлось необходимым: ни одного
непокрытого вопроса, требующего прогона, не возникло).

Обязательные источники роли прочитаны: `docs/SCOPE.md`, `AGENTS.md`,
`docs/process/REVIEWER.md` (раздел «Ревью ТЗ» и общая часть «Отрицательные
проверки и мутанты», «Находки и вердикт»), затем тело issue #1113.

### Проверка обязательных разделов ТЗ (§7.1)

Все обязательные разделы присутствуют и в правильном порядке: сценарий · что
человек увидит до и после · проблема · скоуп и не-скоуп · контракт поведения ·
UX · модель данных и миграция · i18n · критерии приёмки AC1–AC10 (каждый со
способом доказательства) · план автотестов · риски · откат ·
release-артефакты. Два первых раздела — продуктовые и отвечают на «какая
персона/поверхность/момент» и «что видно одной фразой без терминов
реализации» — требование выполнено.

Открытый вопрос (§7.1 «не бывает сложной задачи без единого открытого
вопроса») представлен двумя слоями: семь продуктовых решений владельца уже
закрыты в теле issue (не предмет пересмотра), и присутствует обязательный
блок «Принято предположительно, поменять свободно при ревью» с техническими
решениями, которые я ниже оспариваю по существу вместо того, чтобы выносить
их владельцу (REVIEWER.md: «технический вопрос, вынесенный владельцу, —
находка, ревьюер его снимает и решает сам»).

### Адресная проверка осуществимости (конкретные непокрытые вопросы)

Два места ТЗ выглядели потенциально неоднозначными при первом чтении; оба
закрыты чтением существующего кода без исполнения:

1. **Вопрос:** профиль адресует пространство через «stable ID» (Контракт
   п.1), а существующий `hpspace`/`/kiosk/N` — через позиционный индекс
   (`parseRouteKiosk` → `RouteKiosk.position`, `src/panel-route-kiosk.ts:3-7`,
   `src/route-kiosk.ts:26-33`). Не создаёт ли смешение двух адресных схем
   противоречие в приоритете «путь/`hpspace` → `space` профиля → все
   пространства» (Контракт п.6)?
   **Результат:** не создаёт. `resolveFixedFloor`
   (`src/initial-load.ts:40-59`) уже единообразно резолвит и `string`
   (stable ID) и `number` (позиционный индекс) в один `FixedFloorSelection`;
   `resolvePresentationFloor` (`src/route-kiosk.ts:36-49`) уже строит
   приоритет поверх этой функции для карточечного поля `floor`. Расширение
   этого же приоритета профилем, адресующим по stable ID, не требует новой
   архитектуры — проверено чтением, не исполнением.
2. **Вопрос:** Контракт п.7 описывает автолистание и возврат по простою как
   три ветки («`cycle` > 0», «`cycle` = 0 и `idle` > 0», «`idle` = 0»); не
   оставляет ли это неопределённым случай `cycle` > 0 и `idle` > 0
   одновременно (достижим через независимое переопределение полей по
   приоритету §6, даже если конструктор не даёт включить оба в одном
   профиле)?
   **Результат:** не оставляет — первая ветка сформулирована безусловно
   («при `cycle` > 0 действует правило #462») и по смыслу перечисления
   веток поглощает это сочетание: правило #462 действует всегда при
   `cycle` > 0 независимо от `idle`. Формулировка лаконична, но
   однозначна при чтении веток как исчерпывающего разбора случаев —
   замечания не завожу.

### Сверка технических цитат ТЗ с кодом

ТЗ называет конкретные файлы, функции и номера строк существующего кода как
основание решений. Выборочно сверено точным чтением (не для доказательства
AC, а для проверки того, что ТЗ не строит контракт на несуществующем
поведении):

- `houseplan-card.ts:6732` (`devicePlanRotation.get(...)`) — совпадает дословно.
- `houseplan-card.ts:2588-2592` (`KioskCarousel`, `this._config?.cycle`) — совпадает.
- `websocket_api.py:1839` (`"summary_panel_api": SUMMARY_PANEL_API_VERSION`) — совпадает.
- `summary-panel-identity.ts` (`summaryPreferenceKey`, `path: location.pathname`) и
  `hidden-device-visibility.ts:43-50` (`hiddenDevicePreferenceKey`) — совпадают;
  `presentationRouteOwner(path, panelHost = false)` (`route-kiosk.ts:52-54`)
  действительно существует с заявленной сигнатурой — план «корень панели»
  в Контракте п.10 технически реализуем этой же функцией.
- `preserve_summary_panel_namespace`, `validate_summary_panel_references`,
  `summary_panel_api` — реальные символы (`validation.py`,
  `websocket_api.py`), прецедент для нового `external_screens_api`
  состоятелен.
- `src/editors/marker-alerts.ts` — существует, подходящий образец интерфейса
  конструктора.
- `parseRouteKiosk`/`RouteKiosk` (`panel-route-kiosk.ts`, `route-kiosk.ts`) —
  подтверждают синтаксис `hpspace`-подобного парсинга (`^\d+$`,
  `Number.isSafeInteger`, `> 0`), который ТЗ переиспользует для `hpprofile`.

Расхождений между цитатами ТЗ и фактическим кодом не найдено.

## Находки

Нет находок High или Medium в скоупе. Побочных находок вне скоупа тоже нет —
`outside_findings` пуст.

## Что проверено и корректно

- Состав и порядок обязательных разделов §7.1.
- Однозначность AC1–AC10: у каждого назван наблюдаемый результат и способ
  доказательства (unit/backend/smoke/golden), для защитных AC (AC2, AC3, AC4)
  прямо названы отрицательные/граничные входы (дубли `id`, `id ≥ next_id`,
  уменьшение `next_id`, повторно выданный номер, неверный/отсутствующий
  URL-параметр, границы 0/3600 и 49/50/300/301).
- Состав полей первой версии (9 полей) и имена URL-параметров переопределения
  соответствуют семи решениям владельца из чата (включая то, какие из
  11 изначально названных имён уходят в не-скоуп: `hpfit`, `hpspaces`,
  `hpview`).
- Модель данных (`settings.external_screens`, монотонный `next_id`, запрет
  повторной выдачи номеров, защита от стирания старым писателем, инертность
  будущей версии) по архитектуре и формулировкам параллельна действующему
  прецеденту `settings.summary_panel` (#437) — при сверке найдены реальные
  одноимённые функции и строки, а не описание несуществующего поведения.
  Адресный вопрос о совместимости адресации пространства (stable ID vs
  позиционный индекс) закрыт чтением `resolveFixedFloor`/`resolvePresentationFloor`.
- Изменение приоритета path-формы для `hpprofile`/параметров переопределения
  относительно #1103 (контракт §5) названо явно как «изменение контракта
  #1103» с примером — не скрытая деградация прежнего поведения `hpkiosk`/
  `hpspace`, которое остаётся «целиком» только для этих двух параметров.
- Раздел «Единый локальный ключ» (Контракт п.10) корректно сужен: меняется
  только `path`-компонент ключа для `panelHost === true`, ключи
  Lovelace-карточек (`host: 'lovelace'`) не затрагиваются — согласуется с
  AC9 и с «Не-скоуп»/«Неизменное».
- Release-артефакты: `User-Visible: yes` с перечнем обоих changelog, перечень
  документов для обновления (USER-GUIDE RU/EN, CONFIG-COMPATIBILITY,
  UX-MODES, TOUCH-SUPPORT, ARCHITECTURE, STATUS) покрывает видимые
  изменения; `docs/USER-GUIDE.ru.md` §17 уже описывает текущее поведение
  #1103, которое ТЗ расширяет без переименования существующей терминологии.
- Откат: прежний backend принимает новое пространство имён как неизвестный
  ключ (`ALLOW_EXTRA`), прежний frontend игнорирует `hpprofile` — согласуется
  с §12 «никогда не удалять файл пользователя на догадке» (откат не стирает
  сохранённые профили).

## Чего не проверял

- Кодовый Validate, `tsc`, `npm test`, `gate:small` — не требуются на этапе
  spec (§8, REVIEWER.md); реализации ещё нет, подтверждено (`hpprofile` /
  `external_screens` не встречаются в `src/`).
- Фактическое исполнение будущих тестов (`test/external-screens.test.mjs`,
  `tests_backend/test_external_screens.py`, новые smoke) — их ещё не
  существует; способ доказательства для каждого AC назван и признан
  осуществимым по факту существования прецедентных механизмов, а не
  исполнением.
- Полнота i18n-строк и визуальных golden-кадров по пиксельному содержанию —
  предмет code-review, не spec.
- Производительность и точные формы мемоизации (AC8) — заявлены как
  осуществимые по аналогии (`config-store-events`, `render-invalidation`
  инфраструктура существует), но не реализованы, поэтому не измерялись.

## Гейты

Прогнаны: нет (этап spec не требует кодовых гейтов, §8 REVIEWER.md «Ревью
ТЗ»). Не прогнаны и почему: `npm run gate:small`, `tsc`, `npm test`,
`pytest tests_backend` — реализации нет, предмет ревью — текст ТЗ; их
отсутствие не является находкой на этом этапе. Вместо гейтов выполнены две
адресные проверки осуществимости чтением кода (см. «Адресная проверка
осуществимости» выше) для двух конкретных непокрытых вопросов.

## Маршрут

`route: fix` (зафиксировано заданием, §726 — на spec-этапе иного маршрута
нет).

## Вердикт

Зелёный. High: 0, Medium: 0. Ревью не образует цикл.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6ImU2ZWFiMjdmMDQ4Mzk1MjhlOWE0NjRkOGEzYjUzODdkOWJiZWI2MmI1MzAxZjFhMmUxZjU5OGM3MTc2MGQ5ZGYiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI1NzRiZmZmMGMxZGYwYWJjY2EyYzdmNzczZGZlMDMzMjE5YTQ5MGM1ZjJkYTk2MzM4OTkxMWI1MzNhYmM0OWM4IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTEzLCJzdGFnZSI6InNwZWMiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiIwNTQzZTU3OTYyZDM4YTAyNjAxZDZjYjBiZTA0YWIzZWNjNzY3MDk5IiwidHJlZSI6ImUxMzI1YWI5ZmFhNjlhYzIzMTcwYjBiOGQ5OGU5NDI5Mzk0YmM4ZmIiLCJib2R5RGlnZXN0IjoiYzc1YzUxYzExMzhjN2RlMjYwYzAwMzA5NDQxMzRjNWUyNmRmNDg1YWFlZWVhZjdkMzE1MzRmYzg1NmEyNTQ0ZSIsInByb2R1Y2VyUnVuIjoiNDA2ODEwOTMxNTciLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjUwOWZmYzY5ZTE0MTg1NDQ4MWRjODc4MThhZGI4MDY2NzAyMmRiODZjZmY5MjFjNWE4Njk2NTFmMDk4MzhmOTgiLCJ2ZXJkaWN0RGlnZXN0IjoiMDYyODc0N2NhNmMzNWFjNWMwOTk1MWQ1ZTI1NDE5NmY5NGVmM2FmNmQ4NDVhZjE3MDM4ZDAyOTNmNTU5N2VhMSIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI3YmFmNjM5ZTIwNTM0ODViYWE2MGJhMDIwODU2ODhjYWQwMWM0YTdkOTRjNmY2ODJiODVlOTJiMGE1MTZmMTExIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDY4MTIxODYwLCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTEzI2lzc3VlY29tbWVudC02NDY4MTIxODYwIiwiYm9keURpZ2VzdCI6IjFmZGNmYjk2MjYzMzJhYWE0NTMxYzRlMWMwN2VhNTlmOTlhODAwOGNkNjQ3YjUxMWRiMTA2MTExNjJhMDJjNjIifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `0543e57962d3` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `e1325ab9faa69ac23170b0b8d98e9429394bc8fb`
  ```
  git log --all --format='%H %T' | grep e1325ab9faa6
  ```
- Тело issue: `c75c51c1138c7de260c0030944134c5e26df485aaeeeaf7d31534fc856a2544e`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NDYsIm91dHB1dF90b2tlbnMiOjMzMDU0LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjExNjEyNCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjIxODU4OTYsImNvc3RVc2RFc3RpbWF0ZSI6MS4yMzIzMDcyMDAwMDAwMDAyfV0sInR1cm5zIjozNSwiZHVyYXRpb25NcyI6NDMxMTI1LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS4yMzIzMDcyMDAwMDAwMDAyLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=46 output_tokens=33054 cache_creation_input_tokens=116124 cache_read_input_tokens=2185896 num_turns=35 -->
