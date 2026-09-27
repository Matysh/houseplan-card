# ТЗ #10 — Roomba string pose: полный Stage 2

- Issue: https://github.com/Matysh/houseplan-card/issues/10
- Приоритет: P2
- Статус ТЗ: draft, UX-решение предложено ниже
- Зависимость: HP-VAC-02 Stage 1/#58 должен быть стабилен

## Цель

Для pose-capable Roomba отобразить live puck и server trail из vacuum entity
без camera/rooms, не обещая координаты моделям, которые их не предоставляют.

## Shared parser

Каноническая grammar для `attributes.position`:

1. только string;
2. trim whitespace;
3. удалить не более одной внешней пары `(...)`, если обе скобки присутствуют;
4. split `,` ровно на три token;
5. trim → `Number`, все три finite;
6. результат `{x,y,theta}`, иначе `null` без исключения.

Одинаковый JSON corpus используется `src/vacuum.ts` и `trails.py`. Corpus:
valid whitespace/sign/exponent/zero; missing/extra token; partial parens;
empty/NaN/Infinity/hex/locale comma/object. Backend parser обязателен, потому
что trail записывается при закрытой карточке.

## Source arbitration

- Position-capable camera того же device всегда выше Roomba string pose.
- Явно pinned camera остаётся sticky даже missing; string не делает silent
  fallback вокруг сохранённого выбора.
- В automatic mode string source допустим только у primary `vacuum.*` того же
  marker и только при валидном pose.
- `position:null`/invalid → Tier D: dock marker и обычное управление, без puck,
  trail и calibration error.

## Калибровка без комнат — рекомендуемый two-mark flow

1. Пользователь запускает/ставит робота в точку A, нажимает «Зафиксировать A» и
   кликает соответствующую точку плана.
2. Робот физически перемещается минимум на configurable raw-distance; аналогично
   фиксируются B и plan B.
3. По двум векторам решается uniform scale + rotation + translation.
4. Mirror не выводится из двух точек, поэтому preview имеет явный toggle
   «Отразить ось Y», default off. Theta preview помогает выбрать вариант.
5. Совпадающие/слишком близкие raw или plan points блокируют Apply.
6. Matrix остаётся proposal до Apply; Cancel не меняет config.

Калибровка хранится в существующем `marker.vacuum.calibration[mapId]`; map id
для string pose — stable `roomba-default`, пока интеграция не даёт иной
доказанный идентификатор.

## Runtime и backend trail

Theta преобразуется с rotation/mirror matrix и нормализуется для puck. Recorder
читает position из vacuum state, применяет существующие teleport/stale/run
правила и пишет тот же trail format. HA restart mid-run продолжает current run.

## Field protocol и проверки

- две отдельные уборки, разнесённые точки, повороты и возврат на dock;
- restart HA mid-run; стабильность origin/scale и отсутствие ложного previous;
- parser parity fixture TS/Python;
- source priority camera/string/pinned missing;
- calibration Cancel/Apply/mirror/degenerate;
- модель без pose и временный null;
- beta release только после реального pose-capable Roomba protocol.

## Приёмка

Live puck и trail совпадают с физическим движением после two-mark fit; камера
не уступает string source; сервер пишет путь без открытой карточки; неподдержанная
Roomba деградирует без ошибок и ложных координат.
