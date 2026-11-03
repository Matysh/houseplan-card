# #1226: два завершающих setup-порта после actual41679296259

Область — только доказанные setup/lifecycle assumptions в двух browser scripts. Продукт0c030e700, существующие shared compiled artifacts; build/full suite/HA/golden не запускались. Оригинальные гарантии и лимиты не ослаблены.

## Zigbee enable refresh —44/44 PASS

Исходный CI лог: `output/issue1225-audit-41679296259/process-next-result/process-next/.state/runs/20261103T165919933-41abeafd/smoke_smoke_zigbee_enable_refresh.log`: `TypeError null.querySelector`, setup callback anonymous39 → line73 `dialog.querySelector`, caller266 language/theme loop.

Прежний setup присваивал новую HA/locale-обвязку, сразу делал JS `.click()` и ждал общий двухкадровый `__hpTest.settled`, после чего без ожидания конкретного owner разыменовывал settings dialog. Общий settled не обещает завершения принятия locale/ленивого owner: сам `hp-test.mjs` ждёт Lit/кадры/выходящие модалки, а не создание произвольного нового диалога. `_openSettingsDialog` в `houseplan-card.ts:10948–10960` имеет асинхронную ветвь lazy editor с проверкой актуального adoption epoch.

Порт сохраняет transport hooks и все условия теста; открывает **настоящие** settings/tab/toggle через обычные Playwright locator clicks, которые ждут их видимости/готовности. Приватное присваивание `_settingsDialog`, force, скрытие overlay и повтор попыток не применяются. После этого тот же rendered topology используется для последующих утверждений.

Все44 уникальные original checks PASS, включая no-save/no-load на toggle, ack-before-scan, отказ/конфликт/retry, immutable lifetime/disconnect/session/user/permission, read-only,8 языково-тематических360px layout и keyboard cases.

## Easy converter openings —6/6 PASS

Исходный CI лог: тот же downloaded run, `smoke_smoke_easy_converter_openings.log`: `page.evaluate: Resulting promise was garbage collected` в mount28→50; исключение возникало на cold `await import('/assets/houseplan-panel.js')` внутри evaluate до создания панели, а не на door/host assertion.

Текущий продукт явно поддерживает HA pre-upgrade protocol: `houseplan-panel.ts:10–11,74–91` (`PRE_UPGRADE_PROPERTIES`, `_adoptPreUpgradeProperties`). Порт использует именно этот протокол: создать ещё не upgraded panel, присвоить реальный synthetic hass, вставить в документ; подключить настоящий panel entry как document-rooted module script, дождаться реальных shadow card и `_loadOk`. Это устраняет зависимость setup от evaluate-only dynamic import promise и покрывает реальный порядок HA. Entry, custom element implementation, payload и транспорт не подменяются.

Сохранены полное структурное сравнение скачанного документа с официальным convertEasy, initial/reload: visible opening, exact host.id/host.t, retained backdrop, no orphan; запрет View writes по-прежнему throws. `finish` сохраняет pageerror accounting и честное завершение.

## Команды и evidence

В собственном checkout `/home/matysh/hp-batch2-infra-20261015`:

- `node --check demo/smoke_zigbee_enable_refresh.mjs`, `node --check demo/smoke_easy_converter_openings.mjs`, `git diff --check`: exit0.
- `HP_SMOKE_CHECKS=1 node demo/smoke_zigbee_enable_refresh.mjs`: exit0,44 unique checks, OK; `output/issue1226/final-two-setup/zigbee.log`.
- Первый converter запуск остановился **до сценария** на отсутствующей локальной зависимости yaml. Нужный declared yaml2.9.1 уже установлен в соседнем root: только ignored dependency symlink добавлен в own node_modules, никаких install/build/source edits. Собранный converter index.html SHA256 совпадает с root.
- `HP_SMOKE_CHECKS=1 node demo/smoke_easy_converter_openings.mjs`: после устранения prerequisite exit0,6 unique checks, OK; `output/issue1226/final-two-setup/converter-r2.log`. Прерванный prerequisite attempt сохранён как `converter.log`, не PASS.

Оба фактических запускa выполнены один раз после смысловой правки и готовых prerequisite. Производительность, бюджеты, остальные сценарии и baseline не трогались. Zigbee меняет статус одной ранее классифицированной original row; converter — новая находка actual, **не добавление к исходным122 failures**.
