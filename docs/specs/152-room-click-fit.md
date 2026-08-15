# Issue #152 — click/tap по комнате вписывает её в View

- **Issue:** https://github.com/Matysh/houseplan-card/issues/152
- **Статус документа:** готово к будущей реализации; issue остаётся на `S3-spec`
- **Приоритет:** P2
- **Тип:** feature, обычный трек
- **Пользовательское изменение:** да

## 1. Проблема и результат для пользователя

На большом плане пользователь вынужден вручную совмещать pan и zoom, чтобы
рассмотреть конкретную комнату. После реализации чистый primary click мышью или
одиночный tap по комнате центрирует её и выбирает максимальный допустимый
масштаб, при котором комната целиком видна с безопасными полями не менее 10%.

Поведение действует только в основном View, включая kiosk. Редакторы сохраняют
семантику активного инструмента.

## 2. Scope

В задачу входят:

- единый room hit для мыши, touch и keyboard activation;
- расчёт финального screen-space bounds комнаты в Flat и Isometric View;
- чистая функция fit-to-room с 10% полями и существующими zoom limits;
- управление room-focus intent, resize и отменой при ручном управлении камерой;
- разрешение конфликтов с pan, pinch, long press, double tap и интерактивными
  дочерними объектами;
- доступное действие через существующий room label/card target;
- тесты геометрии, событий, камеры и обеих проекций;
- пользовательская и техническая документация.

## 3. Не входит в задачу

- открытие карточки/диалога комнаты тем же primary click;
- новая кнопка «назад» или история камеры;
- автоматическая смена пространства/этажа;
- изменение room/wall model либо backend API;
- включение устройств, Glow, decor или вынесенной подписи в fit bounds;
- свободное вращение изометрической камеры;
- отдельный animator в обход #82;
- изменение существующего double-click/tap fit всего плана на свободном фоне.

## 4. Геометрический контракт

Пусть фактическая видимая область stage после вычета панелей и системного
chrome равна `W × H` CSS-пикселей. Safe rectangle имеет отступ 10% с каждой
стороны и размер `0.8W × 0.8H`.

Room bounds — axis-aligned bounding box комнаты в финальных экранных
координатах. Он включает:

- пол и контур комнаты;
- видимое тело стен, образующих границу комнаты, с фактической толщиной;
- видимые участки границы около проёмов и стыков.

Bounds не расширяют:

- устройства, их icons/badges и live markers;
- Glow/spill и солнечные лучи;
- vacuum, decor и backdrop;
- tooltip и вручную вынесенная подпись комнаты.

Камера сохраняет пропорции, совмещает визуальный центр room bounds с центром
stage и выбирает максимальный zoom, при котором bounds помещается в safe
rectangle. В Flat для bounds `Rw × Rh` базовая формула:

```text
scale = min(0.8W / Rw, 0.8H / Rh)
```

Результат ограничивается существующими `ZOOM_MIN`/`ZOOM_MAX`. При конфликте
приоритеты: не обрезать комнату → центрировать → максимально приблизить. На
ограничивающей оси поля равны 10% ± 1 CSS px, на другой — не меньше 10%.

Для stage 2000 × 1000 px и квадратной комнаты результат равен 800 × 800 px по
центру: вертикальные поля по 100 px, горизонтальные — по 600 px.

## 5. Flat и Isometric bounds

Flat использует каноническую геометрию пола и граничных стен. В Isometric
сначала применяется текущая canonical scene/projection, затем строится AABB
проецированного видимого тела комнаты. Нельзя вписывать только исходный
plan-space bbox, если после projection стена обрезается или поле становится
меньше 10%.

Расчёт не должен создавать вторую модель стены либо расходиться с render path.
Допускается чистый geometry helper или измерение уже рассчитанных projected
primitives; чтение DOM layout в горячем pointer path допускается только если
профилирование докажет отсутствие заметного forced layout.

При вырожденной/нечисловой геометрии либо stage без валидного размера viewport
не меняется. Действие может быть один раз отложено до первого валидного resize,
если ownership исходного intent ещё актуален; бесконечной очереди не создаётся.
В dev diagnostic фиксируется причина без production console noise.

## 6. Ownership pointer-жеста

Room fit выполняется только если:

1. `pointerdown` и `pointerup` принадлежат одной канонически выбранной комнате;
2. движение не превысило действующий click threshold;
3. sequence не стал pan, pinch, drag или long press;
4. target не принадлежит интерактивному дочернему объекту;
5. одиночный tap не является первой половиной room double-tap sequence.

Для вложенных и пересекающихся hit areas используется тот же resolver и тот же
порядок, что у текущего room hover. Второй resolver запрещён. Неинтерактивный
текст/фон подписи комнаты относится к этой комнате. Glow и другие декоративные
слои не перехватывают room hit.

Device, opening, vacuum marker, HA-link, button, explicit action element и иной
интерактивный потомок полностью владеют жестом: их действие не проваливается в
room fit. `stopPropagation` не должен быть единственным доказательством — общий
gesture arbiter обязан распознавать owner до выполнения действия.

## 7. Double tap и свободный фон

- Double click/tap, начатый на room hit-area, принадлежит комнате и не вызывает
  существующий reset/fit всего плана.
- Room fit выполняется один раз по завершённому single-tap contract, а не
  немедленно на `pointerdown`.
- Double click/tap по свободному фону сохраняет существующий fit/reset всего
  плана без изменений.
- Pan, pinch, drag и long press никогда не завершаются ложным room fit.

Распознавание использует текущие thresholds/timeouts приложения. Новые
независимые константы без общей причины не вводятся.

## 8. Viewport controller и lifecycle

Конечный viewport вычисляет одна чистая функция из room bounds, stage bounds и
zoom limits. Room-focus intent хранит стабильный `spaceId`/`roomId`, а не ссылку
на transient DOM/model object.

- повторный fit уже вписанной комнаты с теми же входами — no-op;
- resize пересчитывает fit выбранной комнаты по новым `W/H`;
- ручной pan, wheel/pinch zoom или явный fit/reset всего плана снимает intent;
- выбор другой комнаты заменяет intent, последний выбор побеждает;
- смена space, mode, projection eligibility, visibility или remount отменяет
  intent и незавершённый transition;
- room fit не меняет модель/backend и не записывает отдельный zoom без центра;
- общий существующий контракт восстановления View после reload сохраняется.

Если к моменту реализации #82 уже есть, переход использует единственный
`ViewportAnimator`, включая retarget/cancel от реально показанного кадра. До
#82 конечное состояние применяется атомарно. При `prefers-reduced-motion:
reduce` оно всегда применяется без tween.

Viewport, SVG и HTML overlays получают один и тот же camera state на каждом
кадре; промежуточное рассогласование hit targets недопустимо.

## 9. Accessibility

- Существующая доступная подпись либо room-card target получает action Enter и
  Space с тем же fit result.
- Для каждой floor polygon не создаётся отдельная невидимая сетка tab stops.
- Accessible name локализован и содержит действие и имя комнаты, например
  «Вписать комнату Гостиная» / `Fit room Living room`.
- Клавиатурная активация не запускает дочернее HA action.
- Перемещение камеры не переносит DOM focus и не закрывает уже открытый dialog
  или tooltip другого объекта.
- Focus-visible не зависит от pointer modality и остаётся различимым.

## 10. Конфликт с #28

Продуктовое решение: primary click/tap по полу комнаты принадлежит fit-to-room.
#28 не может тем же жестом открывать room card. Перед реализацией #28 карточке
нужен отдельный явный trigger — например action у подписи комнаты — и отдельное
согласование. Автоматически открывать карточку после fit запрещено.

## 11. Acceptance criteria

1. Single click/tap по комнате целиком вписывает и центрирует её.
2. Screen-space поля равны 10% ± 1 px на ограничивающей оси и ≥10% на другой.
3. Fixture 2000 × 1000 с квадратной комнатой даёт 800 × 800 ± 1 px.
4. Room bounds включает видимое тело граничных стен и исключает live/decor/label.
5. Flat и Isometric проверяются по итоговой экранной геометрии.
6. Вложенную комнату выбирает существующий canonical hover/hit resolver.
7. Interactive child выполняет только своё действие; Glow не блокирует комнату.
8. Pan/pinch/drag/long press и double tap не создают ложный fit/reset.
9. Повторный fit с теми же входами не меняет viewport/render/storage.
10. Resize поддерживает focus до первого ручного изменения камеры.
11. Invalid geometry/stage не создаёт NaN, прыжок или вечную очередь.
12. Enter/Space на доступном room target дают тот же результат.
13. Reduced motion применяет конечный viewport атомарно.
14. Room fit не меняет config/backend и не регрессирует reload/remount.

## 12. План тестирования

### Unit

- fit helper: landscape/portrait/square stage и room bounds;
- width/height-limited cases, `ZOOM_MIN/MAX`, degenerate и NaN inputs;
- exact 10% padding и центрирование;
- Flat/projected Iso bounds с толстыми стенами и opening;
- intent lifecycle: fit, no-op, resize, manual cancel, space/mode/remount cancel;
- nested rooms и interactive-child priority;
- click threshold, long press, pinch и double-tap arbitration;
- accessible name и keyboard activation.

### Browser smoke

- точная fixture 2000 × 1000 → 800 × 800 ± 1 px;
- вогнутая/узкая комната и разные толщины стен полностью видны;
- tap пола с Glow, затем tap device/opening/HA-link;
- pan/pinch выше threshold и long press не выполняют room fit;
- double tap комнаты не reset-ит, free-background double tap сохраняется;
- быстрый выбор двух комнат, resize и затем manual wheel/pan;
- keyboard, touch, kiosk и reduced motion;
- visibility/mode/space transition во время fit без пустого кадра.

### Golden

- Flat и Isometric до/после fit в light/dark theme;
- overlays остаются синхронны, комната не обрезана;
- новые baselines проходят обычный visual review и не маскируют unrelated diff.

### Performance

- no-op не создаёт update/storage write;
- room fit не вызывает structural geometry rebuild на каждом кадре;
- не появляются новые long tasks на canonical large-house fixture;
- при animated path сохраняется действующий zoom/pan frame budget #82.

## 13. План реализации

1. Выделить canonical room final-screen bounds helper из render geometry.
2. Добавить чистый fit calculation и unit coverage.
3. Подключить room gesture ownership к существующему resolver/arbiter.
4. Добавить room-focus intent и его lifecycle в viewport controller.
5. Переиспользовать #82 animator либо применить результат атомарно.
6. Подключить существующий доступный room target и локализацию.
7. Выполнить typecheck, unit и build; перед beta — smoke, golden и performance.

## 14. Документация и release-артефакты

Поскольку изменение видно пользователю, implementation commit обязан иметь
`User-Visible: yes` и в том же коммите обновить:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`;
- `docs/USER-GUIDE.ru.md` — click/tap, keyboard, fit-all и конфликт действий;
- `docs/CANVAS.md` — bounds, gesture ownership и viewport intent;
- `docs/ISOMETRIC.md` — projected room bounds;
- `docs/TESTING.md` — новые smoke/golden сценарии.

Нужны reviewed Flat/Isometric golden artifacts и browser smoke report. Новые
строки accessible name добавляются в обе локали проекта с parity-проверкой.

## 15. Риски и откат

| Риск | Мера |
| --- | --- |
| Click конфликтует с pan/child action | единый gesture owner и smoke matrix |
| Iso room визуально обрезана | финальный projected screen-space bounds |
| Камера прыгает при resize/tween | стабильный intent и single controller |
| #28 занимает тот же жест | primary click закреплён за fit |
| Forced layout замедляет tap | geometry helper и performance trace |

Откат удаляет room action и intent, возвращая ручную навигацию. Модель,
storage schema и backend не мигрируют, поэтому data rollback не требуется.

## 16. Принятые предположения

- 10% измеряются от фактической видимой stage в CSS-пикселях;
- room boundary wall body входит в bounds, остальные visual layers — нет;
- существующий room hover/hit resolver является единственным authority;
- до #82 переход атомарный, после #82 использует общий animator;
- существующий double-click/tap fit всего плана остаётся только на свободном фоне;
- отдельный публичный trigger room card относится к #28, не к этой задаче.
