# Task impact #1216

Вердикт: **надо**, вместе с незавершённой предбета-корректировкой #1167.

Задача: https://github.com/Matysh/houseplan-card/issues/1216.
E2E impact: https://github.com/Matysh/houseplan-e2e/issues/15.

В существующий фиксированный first-run admin journey добавлен реальный native
L/X с разными толщинами, проверка единого stored crossing node, drag endpoint
с сохранением ID, принятые Undo/Redo, portable full export и reload без новой
revision. Новый кандидат обязан объявлять plan_graph_api1/graph_change_api2.
Набор остаётся из 13 beta cases; старые версии сохраняют свой first-use journey.

Проверки математического покрытия, разных совпадающих ID/virtual T, finite
supports, host-only cuts и Static/ISO/PDF/light остаются независимыми unit и
синтетическими browser проверками продукта. Durable v1/v2 mismatch, свежесть
backup/source history, projection refusal и upload cancel/replace/revoke/TTL/CAS
покрывает настоящий HA pytest Store/HTTP/WS harness #1216: их executor fault
injection не дублируется через DOM. Новый Docker journey проверяет именно
доставку настоящей панели, native edit → server truth → reload.

Исполнение и SHA кандидата будут записаны после предбета-прогона. Этот файл
не объявляет ещё не выполненные проверки успешными и не принимает PNG эталоны.
