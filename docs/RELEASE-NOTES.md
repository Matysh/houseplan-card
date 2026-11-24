<!-- release: v1.86.1-beta.7 -->
<!-- base: v1.86.1-beta.6 -->
<!-- language: ru -->
## House Plan 1.86.1-beta.7

При открытии плана видна одна плашка «Обновляем план». Готовый вид плавно появляется на месте совместимого статичного превью из браузера или с сервера. Если превью нет, план проявляется поверх фона. При недоступной подложке план всё равно открывается (#1545).

В 2,5D маски теней и устройств переиспользуются при совпадении геометрии. Серия зума и возврат на уже показанный этаж могут завершаться быстрее (#1546).

<!-- language: en -->
## House Plan 1.86.1-beta.7

Opening the plan shows a single loading status. The live plan fades in over a compatible static preview from the browser or server, or over the canvas background when there is no preview. The plan still opens if its backdrop is unavailable (#1545).

2.5D reuses shadow and device masks when their geometry matches. This can shorten settling after repeated zoom and returning to an already displayed floor (#1546).
