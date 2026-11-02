# Киоск: переключатель пространств — #1127

[Согласованный контракт](CONTRACT.md) · [Передача исполнителю](IMPLEMENTATION.md)

Получить ветку codex/1127-approved-ui репозитория Matysh/houseplan-card. Нужны Git, Node.js 22+, PowerShell на Windows либо unzip на Linux/macOS. Из корня checkout:

~~~sh
node demo/ui-lab/prepare-ha.mjs
node docs/design/1127-kiosk-switcher/2026-11-02/replay.mjs --repo . --port 18927
~~~

HA frontend подготавливается один раз; --ha-cache PATH задаёт другой кэш. Replay скачивает официальный ZIP 1.84 Beta 2 с проверкой SHA256; можно передать --release-zip PATH. npm install и сборка не нужны. Остановка Ctrl+C.

- Киоск: http://127.0.0.1:18927/HousePlan?hpkiosk=1 — нажать свободное место плана, затем оставить без действий на 5 секунд.
- Обычный View: http://127.0.0.1:18927/HousePlan — группы нет.
- Киоск одного закреплённого пространства: http://127.0.0.1:18927/HousePlan?hpkiosk=1&hpspace=1 — группы нет.
- Полноценная обычная карточка: /dashboard.

fixture.json — публичные синтетические данные, без частного бэкапа или доступа к настоящему HA. runtime/ и overrides/ сохраняют вид стенда. screenshots/ — финальный вид после двух уточнений владельца; approval.json, journal.json, provenance.json — согласование, решения, база и SHA256.

Предыдущие прототипы включены только как окружение; объём #1127 ограничен CONTRACT.md. Продуктовые тесты, сборка и CI не запускались.
