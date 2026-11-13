# HA-компоненты и автономный редактор — исследование #1393

Дата: 14.11.2026 (Москва). Исходники: `281365641f6194a26a3cfb5fffcc0fb20ed4dea9`.
Общий план: [#1390](https://github.com/Matysh/houseplan-card/issues/1390).
Это исследование фазы 0: продуктовый код и поставка интеграции не меняются.

## Решение

Владелец 14.11.2026 явно принял направление: **автономная поверхность — House Plan
UI Kit и локальные SVG; внутри HA остаются настоящие HA-компоненты**. Источник —
ответ в чате на вопрос по #1393: «Да, UI Kit и локальные иконки для автономного
редактора». Решение выбирает архитектуру, но не принимает внешний вид будущей
реализации и не запускает публичный сайт.

Не создавать второй набор редакторов или копию модели. Нужен узкий
presentation-адаптер над существующими painters/lifecycle, дополняющий host-порты
[#1392](https://github.com/Matysh/houseplan-card/issues/1392) и capabilities
[#1394](https://github.com/Matysh/houseplan-card/issues/1394).

## Инвентарь

AST-инвентаризация 588 `.ts` файлов на указанном SHA находит **7 отрисовываемых
`ha-*` тегов в 46 файлах**. Простое текстовое упоминание `ha-*` есть в 90 файлах:
туда входят комментарии, CSS и строки статусов, поэтому это не 90 независимых
компонентных зависимостей. Исходное число 43 из issue было предварительным и не
является актуальным полным инвентарём.

Считаются места в сегментах `html`/`svg` tagged templates, а не число экземпляров
в открытом плане. Вложенные templates не считаются второй раз. Все точные
файлы/строки, включая 43 файла с `ha-icon`, перечислены в
[машинном инвентаре и измерениях](1393-ha-components-measurement.json).

| Компонент | Мест | Владельцы и использование | Нужен plan-only | Зависимости | Выбор для автономного UI |
|---|---:|---|---|---|---|
| `ha-icon` | 221 | 43 файла: toolbar/header, `houseplan-editor-runtime`, свойства, `hp-dialog`, room/space/opening/decor/stairs/Optimize/print; также device, Zigbee, radar, summary, vacuum поверхности | Да, в поддержанных меню/диалогах | Набор иконок, размер/цвет, HA icon resolver; текущий bootstrap может дополнительно читать MDI JSON | Локальный SVG painter из конечного UI-набора и существующих локальных device assets. Не загружать весь MDI-каталог для одной иконки; unknown fallback. В HA не заменять глобальный `ha-icon` |
| `ha-dialog` | 2 | `src/hp-dialog.ts`, две ветки общего shell | Да | HA modal/focus/scroll lifecycle, locale context, theme tokens | Переиспользовать существующую native `<dialog>` ветку `HpDialog`, общие UI Kit tokens и handlers; adapter сохраняет nested/dirty/return-focus/exit семантику. Это не создание новой независимой modal-системы |
| `ha-card` | 6 | `houseplan-card.ts`, `space-card.ts`; корневой контейнер и static-card | Контейнер полноценного редактора — да; отдельная static Lovelace card — нет | Тема, размеры, тени/фон; card-specific DOM consumers | Контейнер UI Kit с тем же узким host layout contract. Перевести реальные DOM-потребители размеров, не просто переименовать тег; static-card за рамками standalone |
| `ha-circular-progress` | 1 | `src/i18n/language-runtime.ts`, ожидание namespace | Да | HA progress element, theme size/ink | Локальный progress painter с теми же loading/error/retry и reduced-motion правилами. Нельзя принять пустой unknown element за spinner |
| `ha-switch` | 1 | `_boolInput` в `houseplan-editor-runtime.ts` | Условно: только формы, использующие этот helper; не отдельная обязательная HA-зависимость | `.checked/.disabled`, `change`, theme | Уже есть native checkbox fallback. Стилизовать существующим Form Kit и сохранить событие/disabled; HA ветку не менять |
| `ha-slider` | 1 | `_rangeInput` в `houseplan-editor-runtime.ts` | Условно: поддержанные поля | min/max/step/value, `input`/`change`, theme | Уже есть native range fallback. Сохранить числовые границы, disabled и completion; общий UI Kit, не новый state owner |
| `ha-form` | 2 | `src/editor.ts`, `src/space-editor.ts`, GUI конфигурации Lovelace | Нет | HA selectors/schema/localize/hass | Не переносить: это конфигураторы встраивания в HA, а не формы стен/комнат/проёмов. В автономном entry они не импортируются |

### Косвенные зависимости, которые не являются собственными тегами плана

- `ha-panel-custom` встречается в комментарии `houseplan-panel.ts`: его создаёт
  HA-контейнер. Нельзя засчитать комментарий как восьмой renderer-компонент.
  Автономный entry получает свой host mount, а не поддельный custom panel.
- `ha-drawer` ищется через composed path в `panel-sidebar-state.ts`; это мост к
  навигации HA. В автономном хосте его нет, и команду открытия HA sidebar не
  показывают (#1394).
- `ha-bottom-sheet` распознаётся в `HpDialog` при вложенной модальной обработке.
  Нужно сохранить корректный focus/close contract, но не копировать весь HA
  bottom-sheet, если автономный UI его не создаёт.
- Публичный `home-assistant` readiness barrier entrypoints важен внутри HA
  (его scoped custom-element registry). В автономном entry не нужно поднимать
  фальшивый HA root, чтобы снять этот барьер; отсутствие HA имеет собственный
  явный bootstrap.
- `.hass` в `hp-dialog` и других presentation-bridges не даёт бизнес-логике права
  читать states/registry/auth. Минимальный UI context и связь с host event/revision
  конкретизируются в #1392; одного удаления transport calls из диалогов мало.
- Тема, Roboto, namespace dictionaries, CSP и иконки тоже должны иметь локального
  владельца. Готовый modal без корректного шрифта/локали не является паритетом UI.

## Варианты и риски

| Вариант | Что переиспользует | Цена и риск |
|---|---|---|
| Нынешний UI Lab bootstrap | Настоящие `ha-dialog/icon/card`, закреплённые фабрики HA, токены/context | Хорош как локальный визуальный стенд. Зависит от private module IDs/patch entry и integrity cache; это не поддержанный SDK для сайта |
| Урезать выбранный набор HA | Оставить dialog/icon/context/theme, заменить только card | Мало экономит на данном pin: основная цена остаётся в app/runtime/реестре модулей, локали и иконках. Поддержка новых HA версий и transitive license inventory всё равно нужна |
| UI Kit/native + локальные SVG | `HpDialog` lifecycle/native branch, Form Kit/reading/motion tokens, renderer и локальные assets | Выбран владельцем. Нужно проверить focus/close/scroll, unknown icons, dark/light, units/locales, card-size readers и lazy entry. Не обещает автоматический pixel parity по одному probe |
| Смешанный вариант | Свои controls/icons, заимствованный HA modal или отдельные исходники | Дополнительная граница обновления/лицензий без доказанной нужды. Оставлять лишь при установленной нехватке native shell, не как исходную архитектуру |

Относительная трудоёмкость: inventory/решение завершены здесь; конечный набор
SVG и native controls — небольшие изолированные изменения; modal/focus и
container readers — средний риск; автономный entry и полная приёмка редактора —
самостоятельная сквозная задача. Календарный срок без реализации/полной матрицы
не измерялся и не выдаётся за оценку готовности сайта.

## Измерения: что именно сравнивалось

**111 МБ — размер установочного wheel, не браузерная загрузка.** Pin UI Lab:
`20260930.4`, `110732939` bytes,
SHA-256 `05c207fb6ce6720d1782766b54a67acdf4bab83f133a562204b972d062862fc8`.
В текущем проверенном cache 2892 файла и 3071 запись module index.

Проведено 15 изолированных измерений оболочки, по 5 на вариант. Использовались
одинаковые исходники `HpDialog`, input/select/button и UI Kit actions, один
Roboto/theme; HA в первых двух вариантах поднимается штатным offline bootstrap
UI Lab. Native — существующая native-ветка и исследовательский конечный SVG
close icon. Это **не готовые альтернативные сборки всего редактора** и не
замер Save/geometry/первого кадра большого дома.

Среда: Node 22.23.2, Playwright Chromium 151.0.7922.34, Ubuntu WSL2
`6.18.33.2-microsoft-standard-WSL2`, Ryzen 9 7950X, 32 logical CPUs,
1280×900, `en-US`, reduced motion. Loopback без throttling; новый browser context
на sample; Playwright route interception выключает HTTP cache. Readiness —
завершение обновления shell и двух animation frames; дополнительно проверены
видимый input и отсутствие page errors. Время шрифтов/последующих ресурсов
учитывается в resource inventory после короткого settle, но ready-time не
выдаётся за полную визуальную стабилизацию страницы.

| Probe | Ресурсы, decoded bytes (медиана, без HTML) | Запросы с HTML | Ready, медиана |
|---|---:|---:|---:|
| Текущий HA offline bootstrap: dialog/icon/card | 1 548 459 | 20 | 143,2 мс |
| Урезанный HA: без card | 1 537 661 | 19 | 128,4 мс |
| UI Kit/native shell + finite SVG | 198 166 | 5 | 39,2 мс |

Отдельный общий probe bundle — 65 828 bytes, gzip 19 561 bytes. У native два
Roboto font файла занимают 130 116 bytes и пока обслуживаются локальным cache
для сопоставимости; это **не** утверждение, что будущий standalone уже имеет
самостоятельную поставку/лицензирование шрифтов. Будущий entry должен положить
их в свои локальные assets.

Статическая замкнутая сумма HA JS-chunks по pinned metadata: current — 18 файлов /
984 374 bytes / gzip 298 370 bytes; reduced — 17 / 973 609 / 294 541. Это другая
метрика: она включает все объявленные dependencies, но не locale, fonts, MDI и
module-index JSON. Динамическая загрузка исполняет только реально достигнутые
ветки; поэтому сумму нельзя называть фактически переданными JS bytes страницы.
Один `/ha-modules.json` в данном bootstrap — 452 498 bytes, app — 577 116.
Удаление card экономит около 10,8 КБ в данном page probe, не сотни мегабайт.

Полные наборы samples, фактические пути ресурсов, inventory и pin находятся в
[measurement JSON](1393-ha-components-measurement.json). Программа и команды —
[reproducer](1393-probe-reproducer.md). Она собирает только временный probe,
не продукт; данные HA не запрашиваются. Новые PNG/visual baselines не снимались
и не принимались. Product S6/build/lint не выполнялись: изменение — документация
результатов исследования; исследовательская компиляция probe не выдаётся за S6.

## Лицензии

Не предполагать, что заимствованный HA frontend покрыт MIT репозитория House Plan.
Официальный [раздел лицензирования HA](https://contributors.home-assistant.io/start/licensing/)
указывает Apache-2.0 для frontend; конкретный pin и транзитивные зависимости
потребовали бы сохранения соответствующих license/notice при заимствовании.
Это ещё одна причина не превращать offline cache в поставку сайта.

MDI и локальные device icons уже имеют записи в `THIRD_PARTY_NOTICES.md` и
`custom_components/houseplan/licenses/mdi.txt`; при новом конечном UI-наборе
их provenance/notice сохраняются. Выбор собственной оболочки не отменяет
лицензий Lit, Roboto и других реально поставляемых зависимостей. Их финальный
инвентарь относится к автономной поставке, которой здесь ещё нет. Это технический
инвентарь, не юридическое заключение о будущем сайте.

## Последующие задачи и граница завершения

После решения владельца заведены, но не запущены:

- [#1422](https://github.com/Matysh/houseplan-card/issues/1422) — автономный
  presentation-адаптер на UI Kit и локальных SVG. Зависит от #1392/#1394.
- [#1423](https://github.com/Matysh/houseplan-card/issues/1423) — отдельный
  автономный entry/bootstrap и полная сквозная приёмка без HA frontend. Зависит
  от #1391/#1392/#1394/#1395 и #1422; штатные HA entrypoints не меняет.

Обе задачи заблокированы отдельным стартом следующей фазы #1390 и закрытием
зависимостей, а не ожиданием решения об UI-подходе. Облачное хранение, публичный
Python-сервис, endpoint origin, регистрация, quotas и выпуск сайта сюда не входят.

Критерии #1393 закрываются документом, актуальной таблицей, воспроизводимым
ограниченным сравнением и принятым направлением с заведёнными задачами. Наличие
probe не доказывает, что весь редактор работает без HA: это результат #1423.
