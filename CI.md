# CI: проверенный продукт в main

**Passing:** продукт в main соответствует подтверждённому выпуску.

Main: [`07c8ea6798bb88209177cf014d69e3c59a377bf1`](https://github.com/Matysh/houseplan-card/commit/07c8ea6798bb88209177cf014d69e3c59a377bf1).
Статус использует уже завершённые проверки выпуска. Новых тестов, сборок или гейтов этот отчёт не запускает.

Проверенный коммит: [`e2d2d613a27f9229bb6eb87d4f6e081261efee93`](https://github.com/Matysh/houseplan-card/commit/e2d2d613a27f9229bb6eb87d4f6e081261efee93).
Выпуск: [v1.83.1](https://github.com/Matysh/houseplan-card/releases/tag/v1.83.1). Профиль: **hotfix**.
Завершение исходного результата: 2026-10-31T13:52:24Z. Исторический запуск: результат run, обязательных jobs и шагов повторно прочитан из GitHub.
Источник: [GitHub Actions](https://github.com/Matysh/houseplan-card/actions/runs/41204595040).
Сопоставление после исторического переноса обвязки: [`9b34ff9cbd480677f0adceece245a06f4de0eee5`](https://github.com/Matysh/houseplan-card/commit/9b34ff9cbd480677f0adceece245a06f4de0eee5). #1105 перенесла инструменты визуальных проверок; код продукта, готовая интеграция и зависимости сохранились. Различия ограничены четырьмя указанными версиями вспомогательных файлов. Это однократное сопоставление; дальнейшие изменения автоматически не засчитываются. Это не отдельный тестовый прогон этого коммита.

<details>
<summary>Состав исходных проверок</summary>

- Фронтенд: типы, юниты, мутанты, синхрон бандла: Build; Pure product units on fresh emitted modules — success.
- Бэкенд: pytest в Home Assistant: Backend unit tests (pure + HA harness, coverage) — success.
- Геометрия: TS/Python parity исполнена: Компилировать TS-зеркала стыков и идентичности/переноса стен; Сравнить настоящие TS/Python validators (fail closed) — success.
- Смоки в браузере (шард 1 из 3): Smoke suite (шард 1 из 3) — success.
- Смоки в браузере (шард 2 из 3): Smoke suite (шард 2 из 3) — success.
- Смоки в браузере (шард 3 из 3): Smoke suite (шард 3 из 3) — success.
- Golden-кадры против принятых эталонов: Capture or verify golden matrix — success.

</details>

Изменения документации, тестов и процесса сами по себе не отменяют уже полученный результат для прежнего продукта. Passing означает успешный набор данного выпуска; hotfix не выдаётся за полный stable-набор.
