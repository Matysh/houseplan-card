# ТЗ #30 — Информационная архитектура длинных диалогов

- Issue: https://github.com/Matysh/houseplan-card/issues/30
- Приоритет: P1
- Статус ТЗ: ready for review
- Ограничение: только UI/form-state; stored model и `hp-dialog` contract не меняются

## Цель

Разделить независимые пользовательские задачи в Space, Device и General
Settings dialogs, сохранив единый draft и стабильный footer.

## Адаптивный паттерн

- `>= 720px` доступной ширины dialog: вертикальная side navigation слева,
  активная section справа.
- `< 720px`: один последовательный список `<details>`/accordion, открыт ровно
  один раздел; заголовки остаются видимыми в body.
- Горизонтальные tabs с обрезанием/скроллом не используются.
- Выбранная section локальна dialog session и не сохраняется в config.
- При validation error интерфейс открывает нужную section, фокусирует поле и
  связывает сообщение через `aria-describedby`.

## Разделы

| Диалог | Разделы |
|---|---|
| Пространство | Основа; Комнаты и подписи; Внешний вид; Окружение |
| Устройство | Привязка; Действие; Состояние и свет; Внешний вид; Информация и файлы |
| Общие настройки | Цвета; Окружение; Обслуживание; О продукте |

Lifecycle actions Hide/Delete остаются в footer device dialog и не прячутся в
section. Save/Cancel принадлежат всему draft, а не текущей section.

## Условная видимость

- controls/is_light/radius — только для on/off-capable binding либо явного
  opt-in; сохранённые значения не стираются при временном скрытии section;
- climate temperature — только при climate capability;
- vacuum — только для vacuum device;
- state/display preview — скрыт у полностью virtual marker, но appearance
  остаётся;
- integration provenance и files — только при наличии данных/поддержки;
- смена binding пересчитывает visibility, не сбрасывая unrelated draft fields.

## Архитектура

Каждый dialog получает typed draft model и массив section descriptors
`{id,label,visible,hasError,render}`. Навигационный компонент не знает schema и
не пишет config. Это согласуется с поэтапной декомпозицией #34.

## Проверки и приёмка

- переключение section сохраняет все несохранённые поля;
- error routing, first/restore focus, Esc и nested dialogs;
- desktop/mobile, длинные ru/en labels, virtual/climate/vacuum matrices;
- footer не меняет ширину/позицию и не получает горизонтальный scroll;
- save старого config без правки даёт эквивалентный payload и визуал.
