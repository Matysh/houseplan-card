# Optimize preflight: исследование #1172

**Итог:** стоимость этого трёхэтажного входа находится в production wall/boolean проходе, а не в обёртке Optimize. На итоговом dev полный preflight имеет warm median495.99 ms / p95516.54 ms; около98.85% инструментированного времени занимает `wallBodiesGeometry`. Подготовка, fingerprint и остаток вместе — около5.93 ms. Небольшой фикс подготовки не способен превратить этот проход в250 ms.

Исследование завершено с сохранённым **FAIL старого абсолютного250 ms**. Runtime, fixture основного сравнения, guards, сам старый benchmark и его бюджеты не изменены. Это не новый release gate и не утверждение о длительности полного клика Optimize/HA/backend.

## Материалы и среда

| Материал | Закреплённый source SHA |
| --- | --- |
| v1.83.0 | `cb2c71ab7b5943e607b83a4f052a734eb36b22f7` |
| latest stable v1.83.1 | `e2d2d613a27f9229bb6eb87d4f6e081261efee93` |
| dev после #1169 и #1153 | `37f59faef16f6efad06387486943d51202c7d57c` |

Node 22.23.2, Linux x64/WSL2 kernel 6.18.33.2, Intel Core Ultra 7 155H,22 logicalCPU. Питание/энергопрофиль неизвестны. TypeScript 5.9.3, polyclip-ts0.16.8, bignumber.js9.3.1, splaytree-ts1.0.2 и lit3.3.3 фактически совпали с lock pins всех материалов; переустановка зависимостей или разные версии clipper в сравнение не подмешивались. Полные версии/lock/source-tree/archive/compiled SHA256 — в JSON.

Материалы экспортированы из Git objects через `git archive`, без изменения working tree и без нового writer/worktree. Для каждого скомпилирована production dependency closure preflight/models/walls/fingerprint/optimizer с его tsconfig; общий существующий `patchImports(...,{coverage:false})` разрешил Node ESM imports. Это подготовка конкретного измеряемого механизма, не полный продуктовый CI.

Один frozen synthetic вход [fixture.json](fixture.json):3 этажа,60 комнат,200 устройств,100 проёмов,60 перегородок,40 колонн,500decor,250 лестниц. У каждого этажа49 stored wall records и80 положительных resolved room-wall intervals. SHA256 `JSON.stringify(fixture.config)` — `eecc2b37b460bcc4d65db87462feef7633addcf5f590dc5fc8a460db70e2bf73`. Частные планы не используются.

Общий [harness](../../../scripts/analyze-optimize-preflight.mjs) SHA256 — `6a29cfd5e242cd78a50899139d38c6cae06e1227a8c6679c33871c9d627be0e1`. Первичные данные: [historical.json](historical.json), [current.json](current.json); [summary.json](summary.json) содержит только производные сводки.

## Сопоставимые серии

Cold — первый реальный вызов после загрузки модулей в новом процессе,5 отдельных процессов на режим/материал. Node startup, чтение fixture и компиляция вне таймера. Direct-prepared включает подготовку inputs до таймера по определению этого baseline; его cold не выдаётся за полный холодный preflight. Warm —3 прогрева и20 измерений в отдельных процессах direct/full. Cold-порядок режимов чередуется; процессы не прогревают кеши друг друга. Сырые значения и даты каждого worker сохранены.

| Материал | Cold full median / p95, ms | Warm direct median / p95, ms | Warm full median / p95, ms |
| --- | ---: | ---: | ---: |
| v1.83.0 | 636.96 / 678.88 | 490.98 / 527.16 | 494.55 / 559.88 |
| v1.83.1 | 660.87 / 668.71 | 492.42 / 534.17 | 522.53 / 555.35 |
| dev 37f59fa | 633.74 / 645.43 | 488.91 / 511.95 | 495.99 / 516.54 |

В full измеряется весь `checkOptimizeGeometry(config)` до результата на3 этажах: fingerprint, `spaceModels`, prepare, wall и возможный floor fallback не вынесены за границу. Каждый результат требует `ok===true` и ровно3 status=ok. Direct также проверяет null, degraded-extra и failed-core, а не принимает деградированную геометрию за быстрый успех.

В этой серии нет подтверждения нового замедления wrapper: direct и full имеют тот же порядок стоимости, а measured wrapper overhead мал. Небольшие отличия квантилей разных процессов не являются точным временем wrapper или доказанным эффектом конкретного коммита. Неизвестное питание, ограниченные выборки и WSL не дают основания переносить цифры на CI/GPU или обещать причинное ускорение dev.

### Неизменённый прежний benchmark

`demo/benchmark_optimize_geometry_preflight.mjs` из v1.83.0 воспроизведён без правок для каждого production материала с тем же генератором. Его SHA256 — `1e59d64dbc98c46a40128485dc503daa10af06e8a9699e297f35d047853f4c9f`. Порядок direct→complete в одном процессе и его агрегатный формат сохранены; новые raw серии выше устраняют взаимный разогрев отдельными процессами.

| Материал | Direct p95 | Complete p95 | Relative limit | Absolute250 | Exit |
| --- | ---: | ---: | ---: | --- | ---: |
| v1.83.0 | 513.26 | 531.36 | 630.91 | FAIL | 1 |
| v1.83.1 | 518.73 | 512.21 | 637.48 | FAIL | 1 |
| dev 37f59fa | 498.00 | 510.81 | 612.61 | FAIL | 1 |

Relative формула `baseline.p95*1.2+15` проходит у всех; совместный `pass` остаётся false. Первичный FAIL из #1166/CI41198738436 не объявлен PASS и не заменён этими наблюдениями.

## Разложение и повторная работа

Отдельная инструментированная серия:3 прогрева,5 измерений с существующими `CheckOptimizeGeometryOptions` seams. Это средние, суммы компонент аддитивны; они не смешаны с обычными latency рядами.

| Материал | Total | Fingerprint | Prepare | Wall | Floor | Остаток, ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| v1.83.0 | 517.19 | 1.44 | 3.97 | 511.50 | 0 | 0.29 |
| v1.83.1 | 504.05 | 1.34 | 3.86 | 498.57 | 0 | 0.28 |
| dev 37f59fa | 514.20 | 1.41 | 4.22 | 508.27 | 0 | 0.30 |

На каждый полный вызов: fingerprint 1, prepare 3, wall 3, floor 0. В wrapper нет второго полного wall-прохода на тот же этаж. Paper/floor уже получен wall builder, поэтому внешний floor fallback не вызывается; это не означает отсутствие floor-операций внутри builder.

Остаток включает `spaceModels` по одному этажу, display names/guards/обход и измерительный overhead. Независимая серия только model projection (не вычитается из полного времени) дала sub-ms медианы; в v1.83.0 median0.105 ms для всех3 этажей. Geometry внутри prepare не ошибочно приписывается целиком wall/clipper: подготовка и wall измерены отдельными непересекающимися обёртками.

Отдельный CPU profile состоит из3 полных вызовов с sampling interval1000 µs. На dev примерно59.6% семплированного времени приходится на BigNumber,21.6% — polyclip,1.9% — splaytree,7.6% — GC;5.7% — production glue и3.6% — profiler overhead. Это веса семплов, не дополнительная точная декомпозиция latency. Они согласуются с измеренными wall≈99%, указывая на clipping/точные сравнения/аллокирование, а не на дорогой fingerprint.

`wall-boolean-cache.ts` вне gesture-owned scope направляет операции прямо в библиотеку. `_checkOptimizeGeometryImpl` вызывает pure pass без reuse/captureWallGeometry; каждый повторный вызов снова выполняет3 wall builder. Это повторная работа между вызовами, а не скрытый двойной проход внутри wrapper. Существующий View cache не доказывает автоматически эквивалентность нового Optimize candidate. Число дополнительных повторов после записи/в реальном HA здесь не измерялось.

Профили: [current](current-37f59fa.cpuprofile.gz), [stable1.83.0](recovered-1830.cpuprofile.gz), [stable1.83.1](recovered-1831.cpuprofile.gz). Исходный `/tmp` material-каталог исчез после завершения historical capture: raw latency/decomposition и summary профилей уже были сохранены. Материалы восстановлены в persistent `.git/research1172`, archive и compiled hashes совпали побайтно. Обычные cold/warm серии не повторялись; только полные historical профили сняты отдельно заново. [profile-recovery.json](profile-recovery.json) связывает потерянные original SHA, сохранённые summaries и новые profile-only captures; их тайминги не подмешаны в основное сравнение.

## Вход production и история250 ms

Исходный fixture не canonical: `optimizePlans` вернул changed=true у всех материалов. Поэтому основная таблица — полный **preflight на старом benchmark input**, не замер всего пользовательского Optimize после преобразования.

Дополнительно на dev 37f измерен полный preflight именно на `optimizePlans(frozen.config,frozen.layout).config`:3 прогрева/20 измерений, median513.09 ms, p95525.18 ms, все3 этажа ok. [Отдельные данные/другой fixture hash](post-optimizer-current.json) не смешаны с исходной comparison. Получение результата optimizer, GUI, сеть и backend не входят в эти525 ms. Они подтверждают, что высокая стоимость не исчезает только от канонизации этого входа.

[История benchmark](benchmark-history.json) показывает назначение250 ms в [482afb73 от22.08.2026](https://github.com/Matysh/houseplan-card/commit/482afb73ebe483e316dcc1652f10736a2215c158). [Изменение fixture23.08](fixture-wall-key-correction.json) заменило fake `perf-wall-*` keys на реальные ключи ([#260/c14dcecb](https://github.com/Matysh/houseplan-card/commit/c14dcecb98f22118cd4b86913b1f5fd03197c201)); позже добавились лестницы. Сам benchmark не менялся. Это факт дрейфа входов после назначения порога, но не доказанная единственная причина нынешних500 ms; исходное августовское окружение/тайминг не восстановлены.

Гипотеза проверена отдельно: старые labels применены только к копии fixture под неизменённым v1.83.0. [Контроль](old-key-counterfactual.json) дал median492.49 ms / p95506.43 ms; современные `lookupWall`/same-span a/b fallback сохраняют80 положительных resolved intervals/этаж и при fake key. Следовательно, этот контроль не воспроизводит исторические отсутствующие тела и не объясняет нынешнюю стоимость. Основной frozen input и budget этим контролем не заменялись.

## Обоснованное следующее действие

1. В #1172 не делать косметическую оптимизацию подготовки: даже идеальное устранение всей prepare/fingerprint/остатка экономило бы в instrumented current лишь5.93 ms из514.20 ms. Нельзя получить250 ms переносом этой работы за таймер или ослаблением geometry/host/junction guards.
2. Если приоритет — убрать синхронную паузу пользователя, следующий отдельный узкий проект: выполнить тот же pure immutable-candidate preflight в отменяемом worker, сохранив полный end-to-end замер, проверку fingerprint/контекста после await и серверную валидацию до записи. Это перенос блокировки с UI, не обещание уменьшить wall-clock до250 ms. Проверки: равные geometry/status/fingerprint на3 этажах, отказ/отмена/устаревший writer без записи, recovery; для space copy тот же контракт.
3. До изменения boolean алгоритма проверить реальную пользу bounded reuse уже проверенной успешной physical geometry через имеющийся `captureWallGeometry` seam. Ключ должен подтверждать весь owned prepared physical input/единицы/algorithm revision, а не только слабый hash; failure/degraded и другой candidate не переиспользуются. Холодный новый input всё равно потребует полного прохода. Это проверяемое предложение, не уже реализованная оптимизация и не основание объявлять warm-cache benchmark PASS250.
4. Старый250 ms оставить видимым диагностическим исходом. Если нужен новый норматив для нынешнего входа/опорной машины, владелец принимает отдельное решение после сопоставимых данных. В этой задаче порог/PROCESS не меняются; действующие release metrics latest-stable продолжают свой независимый маршрут. Исследование не создаёт нового блокера беты.

## Воспроизведение

В подготовленном WSL с Node 22.23.2 и указанными зависимостями сначала доступны tagged objects и current SHA. Скрипт откажется от несовпадающих dependency pins, переписанного compiled material, неподтверждённого fixture/harness, ошибочной geometry или пустого latency ряда. Он не перезаписывает непустой чужой material directory. Не использовать `/tmp` для единственного экземпляра результатов.

```sh
# Из repo с этим диагностическим инструментом; npm ci --ignore-scripts при необходимости.
git fetch origin tag v1.83.0
git fetch origin tag v1.83.1
git fetch origin 37f59faef16f6efad06387486943d51202c7d57c
export WORK="$(git rev-parse --absolute-git-dir)/research1172-repro"
node --input-type=module - "$PWD" "$WORK" <<'JS'
import fs from 'node:fs';import {join} from 'node:path';
const [repo,root]=process.argv.slice(2);fs.mkdirSync(root,{recursive:true});
const rows=[['stable-1.83.0','v1.83.0'],['stable-1.83.1','v1.83.1'],['current-37f59fa','37f59faef16f6efad06387486943d51202c7d57c']];
for(const [label,ref]of rows)fs.writeFileSync(join(root,`${label}.json`),JSON.stringify({repo,ref,label,directory:join(root,label),fixtureRef:'v1.83.0',nodeModules:join(repo,'node_modules')}));
fs.writeFileSync(join(root,'collect.json'),JSON.stringify({materials:rows.map(([label])=>({directory:join(root,label)})),fixture:join(root,'fixture.json'),outDirectory:join(root,'result'),coldSamples:5,warmups:3,samples:20}));
JS
for label in stable-1.83.0 stable-1.83.1 current-37f59fa; do
  node scripts/analyze-optimize-preflight.mjs --prepare "$WORK/$label.json"
done
node scripts/analyze-optimize-preflight.mjs --collect "$WORK/collect.json" > "$WORK/result.json"
```

Для отдельной post-optimizer или counterfactual серии создать другую JSON fixture, записать её config SHA256 и передать `--worker` request с directory/sha/fixture/fixtureSha256/mode=`full`/warmups=3/samples=20; эти cohorts не смешивать с основной. Формат request и проверки видны в небольшом CLI. После успешной серии повтор для изменения формы отчёта не нужен.

Адресные contract tests инструмента в `process-next/test/optimize-preflight-research.test.mjs`: absolute FAIL при relative PASS, отказ пустых/nonfinite рядов, production degraded/failed/null и неполных этажей; отдельные worker-процессы отклоняют изменённые harness/source/fixture и неизвестный mode до запуска production. Это проверки именно этого инструмента, не новая обязательная джоба обычной задачи/беты. Runtime/API/ACL/хранение не менялись; companion HA E2E impact — «не надо».