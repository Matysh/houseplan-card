# ТЗ #35 — Документация текущего пользовательского опыта

- Issue: https://github.com/Matysh/houseplan-card/issues/35
- Приоритет: P2
- Статус ТЗ: implemented
- Тип: docs-only, без изменения поведения

## Цель и аудитория

README/HACS дают честный обзор и первый успешный путь; USER-GUIDE содержит
полную инструкцию; тематические документы объясняют сложные подсистемы. RU и EN
используют одинаковую структуру и актуальную терминологию.

## Deliverables

1. Детерминированные synthetic screenshots:
   - View desktop и touch;
   - создание пространства;
   - создание/закрытие room contour;
   - Plan editor с открытым context tray;
   - Device editor с display preview/provenance;
   - Background editor;
   - room card #28 и device info card после их реализации.
2. Короткая сравнительная таблица инструментов: Контур комнаты, Перегородка,
   Колонна, Граница, Проём — результат, влияние на площадь/свет, ограничения.
3. Матрица input: mouse, touch View, touch editor best-effort, keyboard.
4. First-run путь: install → add card → create/import space → room → bind area →
   place device → View.
5. Несколько карточек: разные `default_floor`, общая server config/layout,
   локальный viewport/mode, ограничения concurrent editing.

## Информационная архитектура

- README.ru/README: ценность, установка, 5–7 ключевых возможностей, first run,
  ссылки на подробности; без длинных reference tables.
- USER-GUIDE.ru и английский эквивалент: полные workflows и edge cases.
- VACUUM, TOUCH-SUPPORT, DECOR-EDITOR и другие тематические docs — authority.
- Changelog не используется как инструкция.

## Производство изображений

Только synthetic fixture без реальных entity ids/планов. Capture фиксирует
viewport/theme/language, изображение хранится рядом с manifest (version,
scenario, source SHA). Alt text обязателен. Старый screenshot удаляется только
после проверки всех ссылок на него.

## CI и качество

- link checker для относительных файлов, headings/anchors и внешних canonical
  links с allowlist transient failures;
- terminology linter для старых названий кнопок;
- проверка паритета обязательных RU/EN sections;
- ручная сверка HACS rendering и mobile README.

## Приёмка

Ни один screenshot/текст не показывает отсутствующий control; пользователь
создаёт первую комнату без changelog; все ссылки валидны; touch degradation
описана честно; обновление screenshot имеет воспроизводимую команду.
