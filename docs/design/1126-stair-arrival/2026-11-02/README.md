# Подсветка лестницы прибытия — #1126

[Согласованный контракт](CONTRACT.md) · [Перенос в продукт](IMPLEMENTATION.md)

Получить ветку codex/1126-approved-ui репозитория Matysh/houseplan-card. Нужны Git, Node.js 22+, PowerShell на Windows или unzip на Linux/macOS. Из корня checkout:

~~~sh
node demo/ui-lab/prepare-ha.mjs
node docs/design/1126-stair-arrival/2026-11-02/replay.mjs --repo . --port 8893
~~~

HA frontend подготавливается один раз; для своего кэша передать --ha-cache PATH. Replay скачивает официальный ZIP 1.84 Beta 2 и проверяет SHA256; можно передать --release-zip PATH. npm install и сборка не нужны. Остановка Ctrl+C.

Открыть http://127.0.0.1:8893/HousePlan. На Ground floor нажать лестницу в Hallway: на 2nd floor пульсируют обе обратные лестницы. Любая возвращает назад. Полноценная карточка: /dashboard. При запомненном увеличении можно вручную нажать «Вписать всё» для просмотра примера; прототип сам масштаб не меняет. Скриншот фиксирует один кадр пульсации, ритм смотреть в replay.

fixture.json — исключительно синтетические данные. runtime/ и overrides/ содержат воспроизводимый вид; approval.json, journal.json и provenance.json фиксируют согласование, решения и контрольные суммы. Ранее согласованные #1207/#1165/#1157 входят только как окружение; объём этой задачи ограничен CONTRACT.md. Продуктовые тесты, сборка и CI не запускались.
