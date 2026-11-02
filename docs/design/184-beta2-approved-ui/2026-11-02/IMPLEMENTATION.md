# Перенос в общие механизмы продукта

| Пункты | Точки реализации / замечания |
| --- | --- |
| 001, 014 | header-space-select.ts, panel-header-menu.ts, общий header houseplan-card.ts; LazyChromeTooltips/ChromeTooltip, navigation styles. Исправление слоя на стыке сегментов общее, не по ID пространства. |
| 002–004 | _renderDecorSecondary и панель стен; общий числовой контрол UI Kit/unitFieldsCss с суффиксом и ограничением пользовательского ввода. |
| 005 | Общий renderer узлов/preview, единый радиус и outline. Не копировать fallback-число из monkeypatch прототипа. |
| 006–007 | navigation.styles.ts, settings-action.styles.ts; общий сегмент закрытия и settingsActionHover/settingsActionTransition. |
| 008–009 | roomFaceHoverPaths как существующее условие; общий ToastPresentation и видимая .stage для геометрии всех плановых тостов. |
| 010, 013 | presentationViewport/displayFit и каноническая камера: относительный zoom может меняться для сохранения фактического экранного масштаба. Не блокировать рост frame. |
| 011–012 | Общий mode transition / panel header flow: заранее подготовленная конечная компоновка, единый прогресс, отмена/cleanup; не переносить clones и private monkeypatch из app.mjs как готовую архитектуру. |
| 015–016 | hp-settings-select, включая fallback portal; sourcePicker, .hpf-list/.hpf-cand: flex-shrink не должен сжимать двухстрочные пункты. Общие выбранное/hover/focus стили. |
| 017 | renderOpeningVisibleGeometry: разделить base/arcTone/leafTone, переиспользовать существующее определение contact active/available. Отдельно окна и ворота. |
| 018–019 | Общий card header и его измерительная копия; base.styles.ts и chrome.styles.ts: grid-card отделить от panel-host, наследовать радиус темы, убрать sticky top внутри grid. |

## Доказанные причины

- UI-010: на повороте 180° после добавления узлов SVG viewBox расширялся при неизменном canonical zoom и размере stage. Wheel и явных команд камеры между кликами не было. Локально сохранение отображаемого viewBox проверялось на 180°/270°; пробные отрезки отменены. Это не отдельный Yandex-specific workaround.
- UI-016: max-height вертикального flex-списка сжимал высоту .hpf-cand; две строки текста выходили за hover. Нужна естественная высота строки и прокрутка списка.
- UI-019: в реальном HA Sections layout=grid принудительно задавал radius 0 и token --ha-card-border-radius:0. Соседние карточки получали 20px из темы. Header был sticky/top:56px внутри overflow:hidden; разница верхних координат карточки/header ровно 56px. Конфигурация карточки не содержала card_mod или отступа. Частные URL/скриншоты не входят в пакет.

## Границы доказательств

Вид итогового прототипа согласован владельцем. Стабильная производительность не доказана. Исходный режим изометрии атомарный; исполнителю необходимо сохранить корректность и согласовать общий переход без регрессии геометрии. Полная функциональная/серверная приёмка и release Golden не выполнялись. Синтетические screenshots подтверждают доступность опубликованного визуала, а не завершение задачи реализации.
