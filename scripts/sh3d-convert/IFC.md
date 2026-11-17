# Architectural IFC import

## English

Choose **IFC — Archicad / Revit** in the [converter](https://houseplan.tech/convert/), select a local IFC2x3/IFC4 `.ifc`, then choose storeys. Review the 2D preview and omissions before downloading each Houseplan space. A partial result has an explicit **Download with the listed omissions** button. The full report names each source element and its GUID/STEP id; **Show on plan** highlights known geometry. An unknown position is reported explicitly. Import the JSON through **Global settings → Backup and transfer**. Connect HA areas/devices afterwards.

The standalone HTML contains the IFC engine and works from disk without a network connection. IFC parsing and conversion run in a dedicated single-thread Worker. Cancel or select a new file to discard the previous job. The 64 MiB input cap is not a promise that every project of that size fits available memory. IFCZIP, IFCXML, IFC4X3 and native Archicad/Revit/KOMPAS files are not accepted.

### Export and supported profile

- **Archicad:** export architectural elements and Zones/IfcSpace. Retain parametric walls/reference axes/material layers and plan footprints. A BREP Body is acceptable for a room if a usable FootPrint is also present. Prefer these data over an export containing only generic bodies. [Graphisoft geometry options](https://help.graphisoft.com/AC/29/INT/_AC29_Help/121_IFC/121_IFC-37.htm).
- **Revit:** include Rooms and Building Story levels; verify containment and split multi-storey walls by level when geometry does not retain a reliable height range. Avoid exporting only the currently visible furniture/MEP model. Space-boundary level 2 is not mandatory. [Autodesk export options](https://help.autodesk.com/cloudhelp/2025/ENU/Revit-DocumentPresent/files/GUID-E029E3AD-1639-4446-A935-C9796BC34C95.htm).
- **KOMPAS:** compatibility is **unconfirmed** without a real prepared export. Default assemblies/proxies are not recognized as a house. IFCConverter.xml can classify elements and assign storeys/spaces, but does not guarantee suitable geometry or door/window void/fill relationships. [ASCON XML mapping](https://help.ascon.ru/KOMPAS/24/ru-RU/sposob_ifc_xml.html).

Straight vertical walls of constant thickness are supported through a reliable axis/layer offset or rectangular prismatic body. Curves, variable thickness and arbitrary body-only reconstruction are outside the profile. Simple room footprints and horizontal swept profiles are supported; holes, disconnected contours and ambiguous boundaries are reported. Open room boundaries remain wall-free. Doors/windows need an actual wall→void→filling relationship and a valid final carrier. Roof windows and holes in slabs/furniture are omitted. Door opening direction defaults to Houseplan and must be checked manually. No contact/lock entities, materials, furniture or automatic HA matching are invented.

Room contours move from interior faces to common wall axes. Consequently Houseplan area can differ from the IFC room area. Metres, millimetres and conversion-based length units such as feet retain physical scale. Storeys of one building share a frame; selecting fewer storeys does not change that frame. Unsupported objects are never silently straightened, stretched or clamped. Independent valid geometry can still be downloaded; an inconsistent floor graph is refused.

### Compatibility evidence

The research inputs are Archicad 20 / IFC4 `AC20-FZK-Haus.ifc` and Revit Architecture 2011 / IFC2X3 `duplex.ifc`, pinned from [web-ifc public samples](https://github.com/ThatOpen/engine_web-ifc/tree/90b526b9b6284244850132193df541e4d3ac3b58/tests/ifcfiles/public). These old files do **not** certify current application versions or arbitrary export translators. Synthetic tests cover dimensions, units, nested/mapped placement, offsets, shared walls and void hosts independently. User exports need version/settings and a reference plan with known measurements; private files must not be committed without their owner's permission.

### Reproducible engine delivery

The 17 November 2026 local diagnostic produced the following editable results (counts are source objects, not split graph edges):

| Export | Storeys | Walls | Rooms | Doors | Wall windows |
|---|---:|---:|---:|---:|---:|
| Archicad 20 / IFC4 | 2 | 13/13 | 7/7 | 5/5 | 9/11 |
| Revit 2011 / IFC2X3 | 4 | 57/57 | 14/21 | 8/14 | 20/24 |

Door direction uses the reported default. The full local report identifies unsupported/ambiguous rooms and geometry, roof windows and final-carrier refusals individually. These losses remain visible before download. Repeat the explicit diagnostic with already downloaded, hash-checked public files:

```sh
node scripts/sh3d-convert/check-ifc-public.mjs /path/to/local/samples report.json
```

It reports actual per-process peak Node RSS and WASM linear-memory allocation separately; neither is a claim about the complete browser process memory. Runtime memory limits are not substituted for measurements.

Ordinary page builds use `vendor/ifc/engine.mjs` and verify its manifest digest; they do not install emsdk. Only engine updates run:

```sh
node scripts/sh3d-convert/build-ifc-vendor.mjs
node scripts/sh3d-convert/build-ifc-vendor.mjs --check
```

The recipe pins web-ifc 0.0.79, its source commit, emsdk 4.0.23 Docker digest, CMake 3.28.4 and dependency commits/archive hashes. Source patches remove transport loaders before generation; SINGLE_FILE embeds WASM. The serializable factory is shared once between Node exports and Blob Worker bootstrap. No URL fallback, pthreads, Three.js or HA runtime dependency is added. See `vendor/ifc/vendor-index.json`, MPL license and dependency notices. Corresponding upstream source and local modifications are linked in the notices and this repository. The heavy reproduction command is separate from ordinary converter tests.

## Русский

На странице [конвертера](https://houseplan.tech/convert/) выберите **IFC — Archicad / Revit**, локальный файл IFC2x3/IFC4 `.ifc` и нужные этажи. Проверьте 2D-предпросмотр и список потерь, затем скачайте отдельный документ пространства на каждый этаж. При потерях кнопка называется **«Скачать с указанными пропусками»**. Полный отчёт содержит имена, GUID/STEP id и результат для каждого объекта. **«Показать на плане»** выделяет известную геометрию; невозможность определить положение сообщается явно. JSON загружается через **Общие настройки → Резервная копия и перенос**. Области HA и устройства привязываются вручную после импорта.

Автономный HTML содержит IFC-движок и работает с диска без сети. Разбор и преобразование выполняются в отдельном однопоточном Worker; отмена или новый файл прекращают прежнюю обработку. Предел входа — 64 MiB, но доступная память может закончиться раньше. IFCZIP, IFCXML, IFC4X3 и родные файлы Archicad/Revit/КОМПАС не поддерживаются.

### Подготовка экспорта и ограничения

- **Archicad:** включите архитектурные элементы и Zones/IfcSpace, сохраните оси/слои стен и плановые контуры. BREP-тело помещения не мешает переносу, если есть пригодный FootPrint. Экспорт только универсальных тел даёт меньше полезных данных. [Параметры Graphisoft](https://help.graphisoft.com/AC/29/INT/_AC29_Help/121_IFC/121_IFC-37.htm).
- **Revit:** включите Rooms и уровни Building Story, проверьте принадлежность этажам. Если нет достоверного высотного диапазона стены, разделите многоэтажные стены при экспорте. Не ограничивайте файл только видимым видом мебели/инженерии. Space boundaries level 2 не обязателен. [Параметры Autodesk](https://help.autodesk.com/cloudhelp/2025/ENU/Revit-DocumentPresent/files/GUID-E029E3AD-1639-4446-A935-C9796BC34C95.htm).
- **КОМПАС:** совместимость **не подтверждена** без реального подготовленного файла. Обычная сборка с proxy-объектами не распознаётся как дом. IFCConverter.xml задаёт классы и принадлежность этажам/помещениям, но не гарантирует оси, контуры и связи проёмов. [XML-кодирование АСКОН](https://help.ascon.ru/KOMPAS/24/ru-RU/sposob_ifc_xml.html).

Переносятся прямые вертикальные стены постоянной толщины с достоверной осью/смещением слоёв либо прямоугольным призматическим телом. Кривые, переменная толщина и восстановление произвольных тел исключены. Для комнат подходят простые плановые контуры и горизонтальные профили; отверстия, несвязные контуры и неоднозначные границы попадают в отчёт. Открытые границы остаются без стен. Двери/окна требуют реальной связи «стена → вырез → заполнение» и допустимого носителя в итоговом графе. Окна кровли и отверстия в плитах/мебели пропускаются. Сторона открывания двери используется стандартная — её нужно проверить. Датчики, замки, материалы, мебель и привязки HA не придумываются.

Контуры помещений приводятся от внутренних граней к общим осям стен, поэтому площадь Houseplan может отличаться от IFC. Метры, миллиметры и единицы с коэффициентом, например футы, сохраняют физический масштаб. Этажи одного здания используют общую систему координат независимо от выбора этажей. Неподдерживаемые элементы не спрямляются, не растягиваются и не обрезаются молча. Независимый корректный остаток можно скачать; противоречивый граф этажа — нельзя.

### Проверенные профили и сопровождение

Локальная диагностика от 17 ноября 2026 дала следующие редактируемые результаты. Это количества исходных объектов, а не разрезанных рёбер графа:

| Экспорт | Этажи | Стены | Комнаты | Двери | Стеновые окна |
|---|---:|---:|---:|---:|---:|
| Archicad 20 / IFC4 | 2 | 13/13 | 7/7 | 5/5 | 9/11 |
| Revit 2011 / IFC2X3 | 4 | 57/57 | 14/21 | 8/14 | 20/24 |

Направление открывания двери используется стандартное с предупреждением. В полном отчёте отдельно названы неподдержанные/неоднозначные комнаты и геометрия, окна кровли и отказы итоговой привязки проёмов; потери видны до скачивания. Для повтора используется команда check-ifc-public.mjs из английского раздела с уже скачанными файлами проверенных хешей. Она отдельно показывает реальный пиковый RSS процесса Node и размер линейной памяти WASM. Это не замер всей памяти браузера; настройки лимита памяти не подменяют измерения.

Исходные примеры исследования — Archicad 20 / IFC4 `AC20-FZK-Haus.ifc` и Revit Architecture 2011 / IFC2X3 `duplex.ifc` из [закреплённого набора web-ifc](https://github.com/ThatOpen/engine_web-ifc/tree/90b526b9b6284244850132193df541e4d3ac3b58/tests/ifcfiles/public). Они не подтверждают актуальные версии программ и произвольные трансляторы экспорта. Синтетические тесты независимо проверяют размеры, единицы, вложенные/mapped-размещения, смещение оси, общие стены и привязки проёмов. Для пользовательского файла нужны версия/параметры экспорта и контрольный план с размерами; публикация частных проектов требует разрешения владельца.

Обычная сборка страницы проверяет digest готового `vendor/ifc/engine.mjs` и встраивает его без SDK. Только обновление движка запускает две команды воспроизводимой сборки, приведённые выше. Закреплены web-ifc 0.0.79, исходный commit, Docker digest emsdk 4.0.23, CMake 3.28.4, commits/хеши зависимостей. Исходные патчи удаляют транспортные загрузчики до генерации; WASM встроен через SINGLE_FILE. Одна фабрика используется Node и Blob Worker. Сетевого fallback, pthreads, Three.js и новой зависимости HA нет. Источники, лицензия MPL и notices находятся рядом с manifest; тяжёлая пересборка не входит в обычные проверки конвертера.
