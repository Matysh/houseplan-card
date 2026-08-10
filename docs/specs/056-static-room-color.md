# ТЗ #56 — Статичная пользовательская заливка комнаты

- Issue: https://github.com/Matysh/houseplan-card/issues/56
- Приоритет: P2
- Статус ТЗ: реализовано в v1.61.0-beta.3
- Совместимо: независимый Glow #55

## Цель

Добавить обычную выбранную пользователем room color как fill option на уровне
пространства и комнаты, не смешивая её с border/name color.

## Модель

- `fill_mode:'custom'` добавляется frontend/backend enum;
- `space.settings.custom_fill?: {c:string,a:number}` — default пространства;
- `room.settings.custom_fill?: {c:string,a:number}|null` — explicit override;
- effective color при room `fill_mode:'custom'`: room value → space value →
  documented default `#607d8b` с alpha 0.18.

Если room наследует fill mode пространства, его custom color всё равно может
быть заранее сохранён и используется только когда effective mode custom.
Смена режима не стирает color.

## Security

Каждый color проходит render-time `safeColor()` #21; backend применяет общий
defence-in-depth validator. Invalid old value не ломает room и получает safe
default без silent config rewrite. Opacity finite/clamp 0..1.

## UX

- Space dialog fill options: Нет, LQI, Свет, Температура, Свой цвет.
- При «Свой цвет» появляется общий `hp-color-opacity`.
- Room dialog: inherit/modes; для custom — «Цвет пространства» либо explicit
  color+opacity с Reset.
- Live preview использует тот же `resolveEffectiveRoomFill` projection.
- Border/name `room_color` остаётся отдельным control с ясной подписью.

## Render integration

Custom entry добавляется в единый fill resolver и автоматически используется
room floor, clean-floor holes и thick-wall opening tunnel fill. Hover сохраняет
effective color. Glow #55 рисуется поверх, но не изменяет stored custom alpha.

## Edge cases

Transparent alpha 0 равен визуально no fill, но mode сохраняется. Nested rooms
имеют независимые colors; parent не красит hole. Light/dark theme, borders off,
partitions/columns и openings используют текущую geometry. Import future modern
color, не поддержанный browser, безопасно fallback-ится.

## Проверки и приёмка

- resolver inheritance/mode/color/alpha truth table;
- frontend/backend enum and range parity #33;
- hostile/invalid/modern color corpus #21;
- room/tunnel/hover/nested visual golden, custom+Glow;
- Save/reload/reset/Cancel и old config no-op roundtrip;
- пользователь может назначить устойчивый цвет комнате без влияния HA state.
