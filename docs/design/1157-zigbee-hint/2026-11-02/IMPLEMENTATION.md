# Перенос в продукт

Изменение находится в runtime/app.mjs: zigbeeMapExplanation и локальная обёртка updated у hp-zigbee-topology-settings. Она добавляет p.hpf-hint сразу после label переключателя; прежняя функция перевода и hp-help не меняются. Тексты RU/EN/DE/FR включены.

В продукте добавить отдельный ключ в src/i18n/topology/{ru,en,de,fr}.json и вывести стандартный hpf-hint в src/hp-zigbee-topology-settings.ts::_renderEmbedded после переключателя внутри его секции. Использовать существующий UI Kit и его отступы, не добавлять частные стили. Подпись не зависит от enabled; справка topology.help остаётся прежней. Не переносить prototype monkeypatch, DOM-инъекцию, observers и CSS polling из лаборатории.

Это только визуальная передача. Маршрутизация, реальные интеграции, сканирование и backend не изменялись.
