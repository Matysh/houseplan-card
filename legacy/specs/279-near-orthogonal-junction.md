# Issue #279 — сплошной почти ортогональный T-стык

- Дата: 2026-08-24
- Тип: regression bug · приоритет P1
- Issue: [#279](https://github.com/Matysh/houseplan-card/issues/279)
- Ветка: `issue/279-near-orthogonal-junction`
- Статус ТЗ: одобрено self-review по решению владельца

Канонические документы: `docs/SCOPE.md`, `docs/WALL-THICKNESS.md`,
`docs/TESTING.md`; связанные задачи #249, #270, #272 и #275.

## 1. Проблема и подтверждённая причина

В privacy-minimized фрагменте beta.8 endpoint-to-endpoint T-стык состоит из
вертикальной стены и входящей стены с допустимым уклоном `0.181315°`. Оси
сходятся точно, но #275 защищает incident strips только при
`|dot| <= 1e-9`. Поэтому оба сектора считаются диагональными и bounded bevel
#249 вырезает из реальной кладки два белых треугольника.

Persisted-модель корректна. Optimize не должен выпрямлять или переписывать
ось: исправляется единая вычисляемая masonry geometry.

## 2. Пользовательский результат

Почти ортогональный T-стык выглядит сплошным во всех режимах и structural
consumers. Сохранённый уклон остаётся без изменений. Явно диагональный узел
#249 сохраняет ограниченную фаску и не возвращает удалённый внешний клин.

## 3. Scope и контракт

Входит:

- единая классификация `near-orthogonal pair` для multi-wall protection;
- защита finite strips в Plan/View/kiosk/Static/hidden Iso, paper/floor и
  light/sun barriers через существующий canonical masonry result;
- exact fixture, boundary matrix, permutation/scale и regression #249;
- production-bundle smoke и exact local acceptance на `C:\Temp\44.json`.

Не входит: изменение persisted coordinates, schema/model version, Optimize,
UI или коэффициента bounded bevel `R`.

Пара rays считается near-orthogonal, если нормализованный
`|dot| <= sin(0.25°)`. Это явный drafting tolerance, а не накопление
scale-dependent экранных допусков. Порог:

- покрывает точный дефект `0.181315°` и его зеркальное направление;
- одинаков для `cell_cm: 1/5/30`, winding, reversed endpoints и порядка;
- не классифицирует как T угол, превышающий `0.25°`;
- не меняет non-orthogonal fixture #249.

Функция сохраняет optional parameter для изолированных boundary-тестов, а
production default использует новый порог. Protected strips по-прежнему
ограничены реальными finite supports; bevel за их пределами работает как #249.

## 4. Acceptance criteria

1. В минимальном fixture с точными координатами node
   `(-0.354166667, 2.954166667)` все три rays защищены; оба прежних cut-клина
   не удаляют area из incident strips, три arm area-connected.
2. Boundary matrix доказывает: `0°`, `0.181315°`, зеркальный уклон и ровно
   `0.25°` защищены; значение выше порога не защищено.
3. Fixture #249 сохраняет пустой `discardedWedgeProbe`, прежний предел `R` и
   отсутствие protected rays.
4. Результат инвариантен к равным/смешанным толщинам, коротким supports,
   `cell_cm: 1/5/30`, permutation и reversed endpoints.
5. Browser smoke на production bundle проверяет semantic probes внутри обоих
   прежних клиньев; mutant со старым `1e-9` падает.
6. Полный приватный `44.json` проходит raw/Optimize/reload без изменения оси и
   без белых вырезов.

## 5. Совместимость, риски и performance

Persisted schema, backend и security boundary не меняются. Классификация
остаётся локальным pairwise проходом rays одного node и не добавляет глобальный
`O(E²)` pass. Главный риск — ошибочно защитить настоящий диагональный клин;
его закрывают строгая верхняя граница и обязательный regression #249.

## 6. Self-review ТЗ

- Scope ограничен renderer geometry и не маскирует дефект Optimize.
- Численный порог задан в физически понятных градусах и имеет обе границы.
- Позитивный exact fixture дополнен отрицательным #249, поэтому решение нельзя
  свести к безусловному заполнению всех multi-wall wedges.
- Все downstream consumers получают исправление из одного structural source.

Вердикт: **approved**. Внешнее spec-review пропущено по прямому решению
владельца.

