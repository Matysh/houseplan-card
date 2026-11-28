# Состояние процесса Houseplan

Владелец поручил переход на #1105 после публикации `v1.84.0-beta.1`.
Текущие правила — [PROCESS.md](../PROCESS.md), команды — `process-next/`.
Старые workflows, hooks и гейты находятся в `legacy/process-v1/` и не служат
дополнительным маршрутом приёмки.

Настройка процесса на 1 ноября 2026 года описана в [отчёте переключения](../process-next/evidence/cutover-status.md). Текущие результаты проверок стабильной ветки публикуются в [сводке CI](https://github.com/Matysh/houseplan-card/blob/process-release-state/CI.md). Состояние очереди и выпуски берутся из GitHub.

Чтобы начать следующую задачу, достаточно обычного поручения с её номером.
Агент читает `AGENTS.md` и `PROCESS.md`, сохраняет установленный трек,
работает в отдельной ветке и завершает задачу через `finish`.
Повторное подключение старых hooks и полные Validate не требуются.

Справочники:

- [DEVELOPMENT.md](DEVELOPMENT.md) — окружение, команды, артефакты и доставка.
- [TESTING.md](TESTING.md) — назначение проверок, технические условия и границы.
- [ARCHITECTURE.md](ARCHITECTURE.md) — владельцы состояния, API и рендера.
- [Каталог наборов](../process-next/catalog/README.md) — конкретные выборки.
- [AUTOMATION-PARITY.md](../process-next/AUTOMATION-PARITY.md) — сохранённые
  milestones, changelog, Telegram, S8 и завершение выпуска.
- [CUTOVER.md](../process-next/CUTOVER.md) — устройство подключения и восстановления.

История обзорных ревью сохранена в
[REVIEW-RESOLUTION.md](../process-next/REVIEW-RESOLUTION.md).
Она объясняет исправления, а не вводит дополнительные проверки новых задач.

Актуальные задачи и их статусы ведутся в
[основном репозитории](https://github.com/Matysh/houseplan-card/issues).
Версии и состояние стенда проверяются по релизам и фактически доставленным
артефактам; этот документ не заменяет их живое состояние.
