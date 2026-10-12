# Измерения входа и веса · #860 · 12.10.2026

Это evidence, не дополнительный канон. Правила — PROCESS, маршруты — AGENTS;
команды `entry-cost.mjs --json`, `repo-weight.mjs`, `decision-context.mjs`.

## Вход

До изменения, dev `3d3894ae`: author 5617 слов, reviewer 5009, canon 23838.
После: 5687 / 5079 / 24054; UTF-8 bytes 53308 / 45178 / 249183,
distinct reads 3 / 3 / 4. Слова — whitespace-separated, не оценка токенов.
Новые адресные команды требуют пояснения (+70 слов в AGENTS), а обязательные
маршруты уже короткие после #634. Удалять правило ради уменьшения числа нельзя;
поэтому не заявляем сокращение обязательного входа или оплаты модели.
Повтор одного файла учитывается/читается однажды; пакет содержит источники,
а не повтор всего конспекта. Pipeline paths всегда возвращают полный canon.

Адресная проба `--issue=803 --historical --limit=1` прочитала один документ
из четырёх кандидатов и вернула действительные anchors старого code r2.
Проба по `src/editors/form-kit.ts` прочитала четыре документа из 24 кандидатов
истории последних 32 коммитов и вернула источник #819 с anchors. Это bounded
подборка, не гарантия нахождения каждого упоминания в архиве. Явный полный
поиск остаётся `rg --no-ignore ... legacy`; обычный rg скрывает только legacy.

## Вес

Linux/WSL, HonorMagicBook, dev `3d3894aecf7df75519d6d497e9a1b3b3dbe40b67`,
2026-10-12T15:32:15Z, **without-gc**: loose 5308 KiB + pack 88947 KiB =
94255 KiB; 291 loose objects, 46 packs, 2 garbage entries / 11 KiB.
Логические blobs HEAD: PNG 232 / 27148668 bytes, bundle 98 / 5592290 bytes,
other 3444 / 56683587 bytes. Object store зависит от всех локальных refs,
а логические bytes не равны скачанному clone/pack size.

Это другой clone/phase относительно Windows post-GC 467.63 MiB от 25.09;
не сравнивать эти числа как рост/экономию. Windows support checkout этого
чата не имеет HEAD; прежний `Documents/dev/houseplan` здесь отсутствует.
Для контрольной точки #628 25.10 нужно измерить **тот же** Windows clone
после отдельно разрешённого владельцем GC по DEVELOPMENT, затем сохранить
новый отчёт и сравнить post-GC метрику с 487.63 MiB. Здесь GC/clone/delete/
history rewrite/LFS/quota не запускались и будущий checkpoint PASS не заявлен.
