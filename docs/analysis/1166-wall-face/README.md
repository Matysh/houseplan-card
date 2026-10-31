# Диагностические материалы #1166

Публичный тестовый экспорт, анализ и воспроизводимые локальные проверки.
Основной документ: [ANALYSIS.md](ANALYSIS.md). Это свидетель дефекта на старом
коде, а не реализация исправления или отчёт о браузерной приёмке.

Исходный файл опубликован без изменений по явной команде владельца. Его SHA256:
`75769f5c1fd870f733a54b48e742b5ccf7acea8e4ec5e88ff07db4644fd0ad34`.
Частный план из отчёта поддержки #1166 в пакет не включён.

## Повторение

Проверено: Node 22.23.2, Python 3, Linux/WSL. Из папки пакета:

```sh
node --experimental-strip-types diagnose.mjs houseplan-space-test-2026-10-31_09-08-46.json
node --experimental-strip-types precision-check.mjs houseplan-space-test-2026-10-31_09-08-46.json
node --experimental-strip-types repair-check.mjs houseplan-space-test-2026-10-31_09-08-46.json
```

Для Optimize и backend требуется отдельный checkout точного v1.83.0
(`cb2c71ab7b5943e607b83a4f052a734eb36b22f7`):

```sh
git clone --branch v1.83.0 --depth 1 https://github.com/Matysh/houseplan-card.git houseplan-release
cd houseplan-release
npm ci --ignore-scripts
npx tsc -p tsconfig.test.json
node scripts/fix-test-build.mjs
cd ..
node optimize-check.mjs ./houseplan-release ./houseplan-space-test-2026-10-31_09-08-46.json
python3 junction-check.py ./houseplan-release ./optimize-results.json
```

Ожидаемый свидетель дефекта: исходный и Optimize graph находят одну грань,
верхнюю не находят; physical preflight проходит, backend отклоняет Optimize
кандидат с junction_limit_distance (0 → 2 нарушения). Второй Optimize no-op.
Точная проекция трёх концов только в диагностической копии в памяти даёт
две грани. Ни один скрипт не записывает изменённый пользовательский экспорт
и не подключается к HA. Скрипты перезаписывают только свои result JSON.
