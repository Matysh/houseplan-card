<!-- release: v1.85.3-beta.2 -->
<!-- base: v1.85.2 -->
<!-- language: ru -->
## Houseplan 1.85.3-beta.2

Изменения после beta.1:

- Новый наклонный 2.5D-вид: проработанные стены и проёмы, 60 объёмных моделей мебели и связь компьютера со столом. Редакторы остаются плоскими. 2.5D пока находится в разработке; у существующего верхнего открывания окна меняется только объёмное изображение — створка наклоняется с неподвижным нижним краем, сохранённая настройка и датчики не меняются. [#1451](https://github.com/Matysh/houseplan-card/issues/1451)
- Подготовленная геометрия этажей сохраняется в локальном кэше. При загрузке может показываться пассивная архитектурная основа, пока готовятся актуальные данные; старые состояния устройств не выдаются за текущие. [#1454](https://github.com/Matysh/houseplan-card/issues/1454)
- Контекстное меню комнаты в редакторе плана объединяет настройки, изменение размера, разделение, объединение и удаление. [#1453](https://github.com/Matysh/houseplan-card/issues/1453)
- Отдельный ZIP планировки всего дома переносит этажи, лестницы и изображения без устройств и HA-привязок. Импорт добавляет планировку, не заменяя общие настройки принимающей установки. Полный бэкап остаётся отдельной операцией. [#1464](https://github.com/Matysh/houseplan-card/issues/1464)

Перед обновлением сохраните резервную копию. После установки перезапустите Home Assistant и перезагрузите страницы Houseplan.

<!-- language: en -->
## Houseplan 1.85.3-beta.2

Changes since beta.1:

- New angled 2.5D presentation with refined walls and openings, 60 volume furniture models and desk/computer links. Editors remain flat. 2.5D is still under development. Existing top-opening windows change their volume appearance only: the sash tilts around its fixed bottom edge; saved settings and sensors are unchanged. [#1451](https://github.com/Matysh/houseplan-card/issues/1451)
- Prepared floor geometry is retained in a local cache. A passive architectural preview can appear while current data is prepared; stale device states are not presented as live. [#1454](https://github.com/Matysh/houseplan-card/issues/1454)
- A room context menu in the plan editor brings together settings, resize, split, merge and delete actions. [#1453](https://github.com/Matysh/houseplan-card/issues/1453)
- A separate whole-house plan ZIP transfers floors, stairs and images without devices or HA bindings. Import appends the plan without replacing the destination's global settings. Full backup remains a separate operation. [#1464](https://github.com/Matysh/houseplan-card/issues/1464)

Back up your plan before updating. Restart Home Assistant after installation and reload Houseplan pages.
