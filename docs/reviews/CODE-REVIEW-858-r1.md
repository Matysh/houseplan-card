# Саморевью #858 — read-only candidate и явная приёмка

Материал: `cfe1e49b0941187da5e95ec16851808bf0fe560f`.
Итог: **зелёный**. High 0 · Medium 0 · Low 0.

Саморевью разрешено владельцем для семи инфраструктурных задач:
https://github.com/Matysh/houseplan-card/issues/855#issuecomment-6125735643.
Фактический diff только B/C. Новый publisher, изменение продукта, выпуск,
автоэталоны, tag/Telegram, модель и исполнение мутантов не запускались.

## Проверено

- Prepare выполняет только GET/local reads и печатает детерминированный
  envelope. Exact SHA/tree, first-parent delivered files (включая merge),
  verified bundle parity/freshness, pins/workflow, ledger, fresh issue bodies,
  scene intent и relevant full Validate proof входят в identity. Повтор без
  новых входов идентичен. Complete readiness не является publish authority.
- Owner login берётся из GitHub metadata, не JSON. Latest owner plan/receipt
  учитывается даже если invalid/revoked; comment overflow fail-closed.
  S8/closed scene intent связан с body/delivered material, ci:golden без
  explicit plan блокирует готовность. Каталог и шаблон доступны из prepare;
  не принимается произвольный список всех красных изображений.
- Intentional drift требует полного набора сцен и existing golden refusal
  oracle; unrelated/new/unknown/partial/timeout отказываются. Existing reviewed
  artifact acceptance остаётся единственным механизмом изменения baseline.
- Native floor использует настоящие browser pointers в существующих
  node/topology и live-coverage сценариях. Launched browser pins обязательны.
  Exit0/OK без exact observable names или topology cycles не доказательство.
  SHA/tree/bundle/pins/environment/output/script hashes связывают отчёт;
  ordinary и risky-neighbour не заменяют друг друга.
- Owner dev acceptance отдельная: actual observations/evidence URLs нужны
  для каждого случая. Raster/compositor дополнительно требует named real GPU,
  non-headless browser и field evidence. Agent/native green не фабрикует
  human receipt. Изменённый материал/body/pin/plan делает receipt stale.
- Local prerelease и оба workflow проверяют свежую готовность до public work
  и повторно непосредственно перед tag/publish. Special publication check
  игнорирует только четыре явных untracked asset контейнера; tracked/source/
  config и другие untracked changes запрещены. Owner command/confirmation,
  version/trailer, ship review, full Validate/performance/real-HA E2E,
  membership, ZIP/passport и public byte verification сохранены.
- Night diagnosis называет exact nested Validate run/attempt/SHA, job/step URLs.
  Same-SHA success не превращает red в «флак». Structured complete same-attempt
  evidence различает assertion/intent/environment/harness/bounded retry;
  unknown честно остаётся unknown. Ни категория, ни partial retry не PASS;
  issue range — кандидаты, не доказанные виновники. Closed/dedup правила сохранены.

## Доказательства

- Полный `npm run gate:small` на code SHA выше: PASS, 117 с. Pre-push обязателен.
- 65 целевых candidate/night/release/contract/derived/ship tests: PASS;
  дополнительные #856 proof-loop fixtures сохранены и проходили (48 вместе
  с candidate/night/release/contract). Есть реальные publisher runner steps с
  отказом неподготовленного материала до public operations; real Git merge
  fixture проверяет first-parent files и две coherent bundle copies.
- `docs/reviews/evidence-858/native.json`: три реальные pinned native команды,
  exit0/OK; node preview/Esc/Undo/raster (28 checks), T/X и 100 lifecycle cycles,
  mouse/touch pinch/held coverage/2.5D/kiosk (62 checks). Это headless-native
  implementation evidence на freshly-built demo, **не** owner/GPU acceptance
  и не ложный release candidate receipt.
- Первый полный gate поймал incoherent test bundle fixture и запрещённый
  lexical monolith anchor в имени fake input; исправлены fixture projection
  и input module name, не продукт и не защитный тест. Первый native consumer
  стартовал до завершения bundle:sync, был остановлен с exit1; preparation
  error сохранена в evidence, не посчитана PASS/flaky. Финальные native
  проходы выполнены после completed producer, на code SHA выше.
- Static mutation readiness: 1370 PASS, execution=0, caught=unknown; четыре
  прежних warning. Два новых cheap witnesses — GPU substitution и unrelated
  golden drift. Мутанты не исполнялись.
- Docs (7 files / 12 external links), whitespace, build/typecheck, bundle
  policy/budget, noUnused/связность и полный unit набор: PASS.

## Ограничения

Owner field attestation аутентифицирована, но содержимое видео автоматически
не распознаётся: это явная ответственность владельца; агент её не подделывает.
Live night без пригодного structured root-cause receipt показывает exact
step и unknown, а не угадывает причину по названию gate. Нет автоматических
ретраев/приёма эталонов. Prepare timing/billed savings не объявляются без
сопоставимого замера. Реального релиза и owner field/GPU proof в этой
инфраструктурной задаче нет и не требуется; будущий рисковый выпуск без них
будет заблокирован. Тонкие default-branch workflows не менялись.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/858-candidate-readiness`, коммит `cfe1e49b0941` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `8d1b0d4d0e763b3b2882f1903f7e93d9702cfd81`
  ```
  git log --all --format='%H %T' | grep 8d1b0d4d0e76
  ```
- Тело issue: `bb021535388df8bac8c9f216857e7e47512cb4dd246fda1585c95d24828ca5ec`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
