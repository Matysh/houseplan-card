# #1306 — диагностика сохранения узла

Источник: https://github.com/Matysh/houseplan-card/issues/1306

Это постоянный пакет синтетических измерений и воспроизведения, а не изменение
продукта. База кода: `f64fa33c347a8a3fe37789ffc444d74c40daa381` (#1305, dev).
Квадратичный `_nodes` также проверен на предшествующем dev
`d5f9aa516768a8c27281d9c118c10db3ae62fc73`: он существовал до слияния узлов.

## Состав

- `report.md`: интерпретация, стадии, границы измерений и направление исправления.
- `measurements.json`: первые и повторные непрофилированные CPU-замеры.
- `validation-calls.json`: низконакладные времена вызовов и fingerprints двух графов.
- `cpu-profile.json`: отдельный cProfile; его времена включают накладные расходы
  профилировщика и не являются непрофилированной длительностью операции.
- `browser.json`: успешный ordinary native pointer → production Python proof → ACK.
- `profile-ordinary.mjs`: генератор 100/1000/5000 валидных рёбер; исходные дома
  пользователей не используются. В каждом случае меняется один конец одной стены.
- `profile-ordinary.py`: отдельные замеры стадий, cProfile и счётчики одинаковых графов.
- `profile-browser.mjs`: synthetic browser wire, одна обычная node_move запись,
  клиентские проверки и ожидание ACK. Это не полная HA E2E и не живой HA владельца.

Нет пользовательских экспортов, credentials или зависимости от локального профиля HA.
JSON inputs на тысячи рёбер генерируются скриптом; binary `.prof` воспроизводится
локально. Исходные результаты не перезаписывать результатом нового сравнения.

## Воспроизведение (Ubuntu/WSL)

Использовать checkout этой диагностической ветки/закреплённого commit. Версии и
зависимости — из `.nvmrc`, `.python-version`, lockfile и backend requirements.
Исходные измерения сделаны с Node 22.23.2 / Python 3.14.7; CPU-времена зависят от машины.
Ниже команды для отдельного подготовленного checkout, не для пользовательского HA:

```sh
npm ci --ignore-scripts
python3 -m venv .venv
.venv/bin/python -m pip install -r tests_backend/requirements.txt
npx playwright install chromium
npx tsc -p tsconfig.test.json
node scripts/fix-test-build.mjs
mkdir -p artifacts/1305
node diagnostics/1306/profile-ordinary.mjs
.venv/bin/python diagnostics/1306/profile-ordinary.py > artifacts/1305/profile-new.log
npm run build
node scripts/bundle-sync.mjs
PYTHON="$PWD/.venv/bin/python" node diagnostics/1306/profile-browser.mjs
```

CPU и browser измерять последовательно, без конкурирующих прогонов. Скрипты
сохраняют исходные пути `artifacts/1305/ordinary-*`, чтобы воспроизведение не
подменялось переписанной версией диагностического harness. В рабочем сравнении
скопировать результаты базы и кандидата в разные каталоги.

Browser fixture задаёт `filter_seeded`, `known_devices`, `new_device_ids`:
начальная регистрация synthetic дома не должна порождать config/set перед node_move.
Первые probe без этой инициализации завершились отказом own queue/timeout; они
не объявляются измерением сохранения и не являются найденной продуктовой ошибкой.

Для реализации дополнительно нужны mixed ownership/rooms/openings/dependencies,
несколько пространств, cold/warm validation, независимые HA ACL/CAS/Store проверки
и негативные контроли из ТЗ. Этот пакет — минимальный воспроизводитель расходов.
