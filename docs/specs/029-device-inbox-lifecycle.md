# ТЗ #29 — Inbox и объяснимый жизненный цикл устройств

- Issue: https://github.com/Matysh/houseplan-card/issues/29
- Приоритет: P1
- Статус ТЗ: draft, требуется UX-утверждение
- Связано: #44 переносит advanced-фильтры в этот интерфейс

## Цель

Заменить разрозненные «Добавить»/«Показать скрытые» одним read-only при
открытии каталогом, который объясняет состояние каждой HA-привязки и даёт
явные действия жизненного цикла.

## Единая классификация

Pure resolver получает registry snapshot, live states, markers и product
filters и возвращает одну запись на canonical binding:

| Раздел | Условие | Основные действия |
|---|---|---|
| Новые | активная допустимая binding без marker/tombstone | Добавить, скрыть |
| На плане | live marker, `hidden !== true` | Найти, редактировать |
| Скрытые | live marker `hidden:true` либо seed-кандидат filter | Показать/добавить, причина |
| Доступные снова | tombstone `removed:true`, binding снова существует | Добавить заново |

HA-disabled binding остаётся в своём lifecycle-разделе, но получает статус
«Отключено в Home Assistant» и недоступное действие показа согласно текущему
контракту disabled devices. Orphaned сохранённый marker остаётся «На плане» или
«Скрытые» с предупреждением, а не превращается в «Новый».

## Причины

Причина — stable enum, локализованный в UI: `manual_hidden`, `ha_disabled`,
`service_entry`, `excluded_integration`, `excluded_domain`, `grouped_light`,
`represented_by_parent`, `duplicate_name_area`, `removed`, `orphaned`,
`limited_registry`. Regex/id могут быть в раскрываемой диагностике, но не в
основной фразе.

## UX

- Кнопка редактора устройств открывает wide `hp-dialog`/side sheet с поиском,
  tabs/filters и счётчиками.
- Просмотр, поиск и раскрытие причины ничего не пишут в config.
- «Найти» переключает пространство, закрывает inbox и мягко выделяет marker.
- «Добавить» открывает существующий device dialog с preselected binding.
- «Скрыть» материализует `hidden:true`, но не `removed:true`.
- «Добавить заново» заменяет tombstone одним live marker и не наследует старую
  позицию, файлы или trail, уже удалённые подтверждённым Delete.
- Все mutation actions получают Undo/confirmation согласно их текущей
  семантике; bulk actions в v1 не входят.

## Инварианты и конкуренция

Canonical binding уникальна. Повторный save и конфликт revision не создают
дубликат. Registry refresh обновляет список с сохранением tab/search, но не
закрывает редактируемый dialog. Limited registry не выводит ложный «удалён».

## Проверки и приёмка

- матрица resolver по marker/hidden/removed/disabled/orphaned/filter;
- два клиента и revision conflict;
- re-add device/entity tombstones, virtual marker вне inbox;
- поиск, keyboard navigation, narrow layout и ru/en golden;
- любой кандидат находится ровно в одном разделе и имеет понятную причину;
- открытие inbox не меняет config/layout/revisions.
