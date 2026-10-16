# Саморевью #856 — complete frontend proof и event continuations

Материал: `c1faf39705012524d8ec30086746408d897b4d36`.
Итог: **зелёный**. High 0 · Medium 0 · Low 0.

Саморевью разрешено владельцем для семи инфраструктурных задач:
https://github.com/Matysh/houseplan-card/issues/855#issuecomment-6125735643.
Только B/C; модель, продукт, пороги, required union и release authority не ослаблены.

## Проверено

- Build уже содержит root typecheck. Отличающийся test emit/fix-test-build и
  noUnusedLocals сохранены. Restore требует complete green source run/attempt,
  exact HEAD/tree/content key, fingerprint, Node/OS/architecture/runner image и
  byte inventories. Issue producer пригоден после фактического продвижения
  именно его SHA в dev/main; неподтверждённая cross-SHA эквивалентность не используется.
- Diff guards, bundle policy/budget и unused выполняются свежими. Красные,
  cancelled, incomplete, expired, чужие/изменённые proofs и повреждённые байты
  не дают reuse. Нет цепочек reused producers.
- Deferred merge связан с epoch/body/latest process/branch/candidate/dev; перед
  записью состояние перечитывается, push защищён lease и reviewed patch-id.
  После фактического push сбой API не означает «ничего не применено».
- Night/release освобождают runner с explicit pending, не PASS. Событие
  проверяется по API, source CURRENT attempt, repo/head repo/path/SHA/expiry и
  последнему child. Ранее уже запущенный release child допустим только если
  его id/attempt/path записаны при подготовке intent.
- Domain dispatch имеет одноразовый CAS-ref, дубликат и неоднозначная доставка
  не повторяют публикацию/модель. Stale branch/tag и cancellation не продолжают
  старую команду. Callback не является новым публикатором: прежний workflow
  заново требует полные Validate/performance и exact-ref real-HA E2E.
- Существующие #633/#636 sealed/epoch helpers сохранены. Periodic recovery не
  вызывает модель повторно для pending integration. Legacy resume сохраняет
  свой узкий страж; тонкий caller имеет явный union прав и own-repo filter.
- Product/tooling file partition покрывает всю unit suite. Неизвестный diff
  выбирает оба; subsets явно локальные, обязательный full hook не отключён.

## Доказательства

- Последний полный `npm run gate:small`: PASS, 119 с на code SHA выше.
- Product subset: PASS, 117 с; tooling subset: PASS, 4 с. Это разные объёмы
  обратной связи, не обещание ускорить весь required union до четырёх секунд.
- 194 целевых unit/workflow tests: PASS; real restore с verified bytes и
  changed config/lock/pin/workflow/corruption negatives; actual runner producer
  и completion steps с отказом cancelled/foreign/failed-source без writes.
- Root `npm run typecheck` до устранения дубликата: 4.839 с локально.
  CI billed minutes/доля экономии live reuse ещё не измерены и не объявляются.
- Static mutation readiness: 1368 definitions, PASS, execution=0;
  четыре прежних warning. Два новых cheap witnesses, пять прежних anchors
  перенесены на эквивалентную защиту нового механизма, не удалены ради зелёного.
- Docs, diff whitespace, bundle policy/budget, unused: PASS.
- Main thin mirror `fe106d8eb2619e647b0db89db436f808587192e7` меняет только
  `process-resume.yml`; его blob совпадает с веткой задачи:
  `334a8db02e7fe6610b96d194dcf3b567643a41ae`. Продукт в main не переносился.

## Ограничения и восстановление

Discovery bounded (100 artifacts / 12 intents), intent TTL 24 часа. Неизвестное
состояние не зелёное. CAS-refs служебные, не release tags; разбор/удаление только
после окончания intent и дочерних прогонов. Ambiguous claim требует проверки
delivery и новой явной команды, не слепого retry. Night queue теперь обозначает
постановку; цвет full проверки следует смотреть в Validate и continuation.
Релиз, tag, Telegram, продуктовые native/golden и исполнение мутантов в рамках
реализации не запускались. #858 отвечает за candidate/interactive diagnostics.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/856-proof-and-event-loop`, коммит `c1faf3970501` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `623f95f5807c59f63fb2beb4eaa804d8135f07ca`
  ```
  git log --all --format='%H %T' | grep 623f95f5807c
  ```
- Тело issue: `41a4ef11f392789db7ac80b87cafa97bbf5fead4d191aba921edb05165bb2454`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
