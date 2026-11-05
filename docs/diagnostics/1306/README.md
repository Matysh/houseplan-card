# #1306 — устранение повторной работы при сохранении узла

База: `f64fa33c347a8a3fe37789ffc444d74c40daa381` (dev после #1305).
Результаты кандидата находятся в этом же коммите. Ubuntu WSL, Node 22.23.2,
Python 3.14.7; synthetic model11 100/1000/5000 рёбер, один перенос одного конца.

После одного прогрева — 5 последовательных измерений на размер и режим без
конкурирующих тестов. `measurements.json` содержит все сырые времена стадий,
median/p95 и SHA256 принятой конфигурации. cProfile здесь не применяется.

| Рёбер | База, median CPU | Кандидат cold | Кандидат warm schema |
|---|---:|---:|---:|
| 100 | 59,31 мс | 32,78 мс | 34,02 мс |
| 1000 | 962,39 мс | 351,60 мс | 360,50 мс |
| 5000 | 8834,48 мс | 2098,76 мс | 2194,17 мс |

На 5000 рёбрах cold CPU быстрее в 4,21 раза, warm — в 4,03. Все 45 accepted
content hashes совпадают между базой и кандидатом на соответствующем размере.
Warm здесь означает только доверенную schema предыдущего документа: junction
baseline намеренно cold в обоих вариантах, чтобы не выдать его кеш за эффект
устранения лишних проверок. Это не абсолютное SLA другого оборудования.

CPU-профиль исключает HA executor/очередь, Store, сеть и UI. Отдельный native
ordinary pointer→production Python wire→ACK probe на 5000 рёбрах: до 10593 мс,
после 4078 мс, одна запись без merge. Это по одному диагностическому замеру,
не median и не живой HA владельца. Current native merge smoke также проверяет
реальный junction callsite: один полный guard на одинаковый ordinary candidate
через held/release, ни одного physical guard на 100 held merge кадров.

Настоящие authenticated HA тесты наблюдают весь WS→Store путь: exact/cold/stale
schema stamp, отсутствие repeated graph passes, отсутствие hidden-space работы
на warm-серии apply/undo/redo, задержанный durable ACK, сбой Store, forged inverse
и невидимый foreign crossing. Новый stamp появляется только после durable save.

## Воспроизведение

В подготовленном checkout собрать `test-build`, затем:

```sh
node scripts/benchmark-node-save.mjs artifacts/node-save-inputs
python3 scripts/benchmark-node-save.py --root BASELINE_ROOT --inputs artifacts/node-save-inputs --out artifacts/node-save-before.json
python3 scripts/benchmark-node-save.py --root . --inputs artifacts/node-save-inputs --out artifacts/node-save-after-cold.json --optimized
python3 scripts/benchmark-node-save.py --root . --inputs artifacts/node-save-inputs --out artifacts/node-save-after-warm.json --optimized --warm-schema
```

BASELINE_ROOT — отдельный read-only export Python-исходников закреплённого SHA;
скрипт загружает его в отдельном процессе без HA `__init__`. Стандартный defaults
`--samples 5` сохранять. Выборку и бюджеты не уменьшать ради результата.

Разобранные отказы подготовки: старый coordinate-write-barrier guard ожидал
прежние имена canonicalizer/revision и три аргумента room handoff. Inventory
обновлён под фактические текущие транспорты; негативные контроли удаления CAS
и schema proof сохранены. Тексты старых FAIL остаются в локальном artifacts/1306,
они не объявлены зелёными результатами. Подробная исходная диагностика до правки
закреплена в пакете задачи на коммите `0d56589263f6f2ac1b6dee5565782bf5df5d18d6`.
