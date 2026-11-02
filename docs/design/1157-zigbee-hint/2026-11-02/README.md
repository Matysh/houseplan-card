# Прототип подсказки Zigbee — #1157

[Контракт и точный текст](CONTRACT.md) · [Перенос в продукт](IMPLEMENTATION.md).

## Воспроизведение

Получить ветку codex/1157-approved-ui репозитория Matysh/houseplan-card. Нужны Git, Node.js 22+, PowerShell на Windows или unzip на Linux/macOS. Из корня checkout:

~~~sh
node demo/ui-lab/prepare-ha.mjs
node docs/design/1157-zigbee-hint/2026-11-02/replay.mjs --repo . --port 8893
~~~

HA frontend подготавливается один раз. Для своего кэша передать --ha-cache PATH обеим командам. Replay скачивает официальный ZIP 1.84 Beta 2 с проверкой SHA256; можно передать --release-zip PATH. npm install и сборка не требуются. Распаковка идёт во временный каталог, исходные данные не меняются.

Открыть http://127.0.0.1:8893/HousePlan → Общие настройки → Диагностика Zigbee. Карточка доступна по /dashboard. Остановка Ctrl+C. Используется публичный синтетический fixture, без частного бэкапа или подключения к настоящему HA.

runtime/ и overrides/ сохраняют текущий локальный вид; fixture.json, replay.mjs и инструкция позволяют запускать его на другом ПК. screenshots/ содержит итоговый вид, approval.json и journal.json — согласование, provenance.json — базу и SHA256. Ранее согласованные #1207/#1165 входят только как окружение; объём #1157 ограничен CONTRACT.md. Продуктовые тесты/сборка/CI не запускались.
