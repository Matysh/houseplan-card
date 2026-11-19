# UI-061: дополнение к принятому UI-060

Согласованные требования и границы: [JOURNAL.md](JOURNAL.md). Задача: [#1474](https://github.com/Matysh/houseplan-card/issues/1474).

Исходный пакет UI-060: https://github.com/Matysh/houseplan-card/tree/c0e7b3d7c2b4256ff20d0f7bf343cec8b660b816/docs/ui-lab-reference/2026-11-19-2_5d

## Воспроизведение на другом ПК

1. Восстановить UI-060 по инструкции исходного пакета на закреплённой базе v1.85.3-beta.2.
2. Поверх product-prototype.patch UI-060 применить этот delta: git apply icon-orientation.patch. Не применять delta к чистому тегу без UI-060.
3. Собрать/запустить тот же синтетический UI Lab согласно исходному README.
4. Для воспроизведения кадров: node capture.mjs --repo <путь-runtime> --url http://localhost:8891/ --out <каталог-кадров>. Сценарий использует синтетическую сцену UI-060 из соседнего каталога и добавляет синтетический battery sensor.

Иллюстрации: glyph-orientation-0/90/180/270-20261119.png. Отчёт и build.log сохранены от предыдущего шага реализации. Проверки при переносе выполняются по актуальному процессу; этот пакет не заменяет продуктовую приёмку.

Оригинальный UI-060 и его ZIP не заменены. SHA256SUMS и source-files.json фиксируют дополнение.
