# Issue #154 — transient hover не залипает после touch

- **Issue:** https://github.com/Matysh/houseplan-card/issues/154
- **Статус документа:** готово к будущей реализации; issue остаётся на `S3-spec`
- **Приоритет:** P1
- **Тип:** bug/polish, обычный трек
- **Пользовательское изменение:** да

## 1. Проблема и требуемый результат

Мобильный браузер после tap может синтезировать mouse-события и сохранять CSS
`:hover`. Одновременно room hover в View управляется `mouseenter`/`mouseleave`,
а touch sequence не гарантирует `mouseleave`. Текущий `_notePointer()` закрывает
`_tip`, но не очищает `_hoverRoom` и не нейтрализует CSS hover.

После исправления touch/pen показывает только краткий pressed feedback на время
жеста. После его завершения transient hover отсутствует. Настоящие mouse и
trackpad сохраняют обычный hover, а на гибридном устройстве последующий mouse
input восстанавливает его после touch без reload.

## 2. Термины и границы состояния

**Transient hover** существует только из-за текущего hover-capable pointer:

- `_hoverRoom`, room fill/outline и room tooltip;
- device marker lift/shadow/brightness;
- opening, room label и control hover styles;
- dialog close/control hover;
- аналогичные чисто визуальные CSS `:hover` состояния общих View-компонентов.

Не являются transient hover и не очищаются этой задачей:

- `active`, `pressed` во время незавершённого pointer sequence;
- selected/checked/current состояния редакторов;
- working, unavailable, alarm, warning, Glow/pulse и иное HA-derived состояние;
- keyboard focus и `:focus-visible`;
- открытый по click/tap toggle-popover `hp-help`;
- открытый dialog либо выполненное action.

## 3. Scope

Обязательный охват основного View:

- room floor/fill/outline/label/tooltip;
- device marker, opening и vacuum marker;
- controls поверх плана и close/action controls диалога;
- tap комнаты из будущей #152;
- long press, pinch, multi-touch и pointer capture cancellation;
- touch → mouse/trackpad на гибридном устройстве;
- смена режима, visibility и lifecycle компонента.

Общие компоненты редакторов получают исправление, если используют тот же
pointer-modality gate без специальной адаптации. Полная поддержка touch-editing
остаётся вне scope согласно `docs/TOUCH-SUPPORT.md`.

## 4. Не входит в задачу

- изменение semantic device/room state;
- новый visual design hover/pressed/focus;
- изменение действий tap, long press или click;
- превращение `hp-help` в transient tooltip;
- исправление touch settings из #149;
- полная переработка gesture arbiter #152;
- глобальный `blur()`, снятие DOM focus либо synthetic click suppression,
  способный отменить пользовательское action.

## 5. Единый pointer-modality authority

Houseplan вводит один session-local источник фактической modality:

```text
unknown | mouse | touch | pen
```

Начальное значение — `unknown`; pointer-only hover при нём выключен. Переходы:

- trusted `PointerEvent` с `pointerType === 'mouse'` включает `mouse`;
- trusted `touch` включает `touch` и немедленно очищает transient hover;
- trusted `pen` включает `pen` и следует touch policy;
- следующий настоящий mouse/trackpad pointer event переводит touch/pen → mouse;
- смена mode/space, `visibilitychange` в hidden и disconnect очищают transient
  hover, не подменяя semantic state.

Media queries не являются authority: браузер может ошибочно сообщать
`(hover: hover)` после touch. Для включения CSS hover одновременно нужны:

1. последняя фактическая modality `mouse`;
2. hover/fine-pointer capability среды.

Компонент применяет единый class/data-attribute gate к View tree; дочерние
shadow components получают ту же modality явным property/attribute contract.
Независимые локальные детекторы и глобальный mutable singleton запрещены.

Modality не сохраняется в localStorage/config и не синхронизируется между
карточками. Она не обязана быть reactive product state, если один безопасный
DOM gate и явная очистка обновляются без лишнего full render.

## 6. Synthetic mouse policy

Touch-generated compatibility `MouseEvent` не может включить mouse modality.
Authority дают только Pointer Events с фактическим `pointerType`; существующие
`mouseenter`/`mouseleave` не меняют modality.

JS room hover переводится на `pointerenter`/`pointerleave` либо общий delegated
pointer path и устанавливается только для разрешённого mouse modality. Touch и
pen никогда не записывают `_hoverRoom`/`_tip` через hover path.

Не использовать произвольный таймаут «после touch игнорировать mouse N ms» как
основной механизм: он ломает быстрый touch → mouse сценарий и зависит от
браузера. Если конкретный браузер отправляет compatibility event как
`PointerEvent(pointerType='mouse')`, допускается только детерминированная
проверка provenance/capabilities этого же input sequence с unit/browser
доказательством; wall-clock suppression без идентичности sequence запрещён.

## 7. Очистка transient hover

Единый idempotent helper очищает только transient hover state. Он вызывается:

- в начале каждого touch/pen `pointerdown`;
- на соответствующих `pointerup` и `pointercancel`;
- при `lostpointercapture`;
- после terminal click/action path до следующего painted frame;
- при начале multi-touch/pinch и после его завершения/cancel;
- при mode/space change;
- при `document.visibilityState === 'hidden'`;
- при disconnect/remount boundary.

Повторный вызов — no-op и не должен создавать render loop. Pointer capture
снимается только владельцем gesture по текущему contract; hover cleanup не
отменяет service call, dialog open или room fit.

После touch terminal event pressed feedback очищается обычным gesture owner.
Transient hover не остаётся дольше одного animation frame и не используется для
имитации pressed.

## 8. CSS contract

Все пользовательски заметные View `:hover` selectors получают общий modality
gate. Как минимум это:

- room overlay/yard/styled fill;
- device normal/alarm lift, shadow и brightness;
- opening outline;
- room-label controls;
- stage controls/options;
- dialog close/action controls и общие card controls, видимые в View.

Один selector не должен случайно смешивать hover с semantic state. Если текущая
rule объединяет `:hover` и `:focus-visible`, её разделяют: mouse hover получает
modality gate, focus-visible остаётся без него. `:active`/explicit pressed styles
также остаются независимы.

Selectors редакторских handles можно оставить вне обязательного охвата, если
они не используются в View/shared component; решение фиксируется inventory в
review. Naked View `:hover` после изменения считается source-contract ошибкой.

## 9. JS hover и tooltip contract

- `_hoverRoom` и `_tip` не устанавливаются touch/pen событиями.
- `pointerleave` реальной мыши очищает принадлежащее target состояние.
- touch `pointerdown` очищает старый mouse hover до выполнения tap action.
- открытие/закрытие dialog не восстанавливает старый hover snapshot.
- tooltip, открытый keyboard focus либо explicit click contract, не должен
  ошибочно классифицироваться как hover; owner хранится явно.
- следующий mouse enter/move заново вычисляет current hit и показывает hover,
  а не восстанавливает устаревший room/device id.

Room fit #152 использует canonical hit resolver непосредственно из gesture
sequence и не зависит от `_hoverRoom`; очистка hover не должна терять room tap.

## 10. Touch, gestures и lifecycle

- Второй pointer немедленно исключает single-tap activation по действующему
  gesture contract и очищает hover.
- Pinch/long press могут выполнить своё существующее действие, но после terminal
  event не оставляют hover.
- `pointercancel`/lost capture всегда безопасны, даже если target удалён renderом.
- Tap → dialog → close не возвращает marker lift/shadow из пред-dialog frame.
- Pen tap следует touch policy; hover stylus не входит в обязательный контракт.
- Kiosk, light/dark theme, Flat/Isometric используют одинаковую modality policy.

Listener `visibilitychange` регистрируется/удаляется симметрично lifecycle и не
создаёт утечку при повторных mount/unmount.

## 11. Accessibility

- DOM focus не снимается touch cleanup helper.
- `:focus-visible` и keyboard tooltip/action продолжают работать независимо от
  последней pointer modality.
- Touch cleanup не меняет `aria-expanded`, `aria-pressed`, selection либо dialog
  focus trap.
- Mouse hover не является единственным способом получить обязательную
  информацию или действие.
- Reduced motion не влияет на state machine; pressed feedback #22 остаётся
  кратким и не превращается в hover.

## 12. Acceptance criteria

1. После touch tap на каждом обязательном View target transient hover исчезает
   не позднее следующего frame после завершения pressed feedback.
2. `_hoverRoom`/hover-owned `_tip` равны null после touch terminal event.
3. Device lift/shadow и CSS hover controls отсутствуют после tap/dialog close.
4. Working/alarm/unavailable/Glow/pulse/selected state не изменяется.
5. Pinch, long press, multi-touch, cancel и lost capture не оставляют hover.
6. Браузер с touch и ложным `(hover: hover)` не показывает sticky hover.
7. Настоящий desktop mouse hover визуально и функционально не изменён.
8. На hybrid device touch → mouse восстанавливает hover первым настоящим mouse
   pointer event без reload и без произвольной задержки.
9. Keyboard focus и `:focus-visible` сохраняются.
10. Cleanup не отменяет click action, dialog, #152 room fit или help popover.
11. Mode/space/visibility/disconnect очищают transient hover без listener leak.
12. В View/shared CSS не остаётся naked hover selector из inventory.

## 13. План тестирования

### Unit/source contract

- transitions `unknown → mouse/touch/pen → mouse`;
- compatibility MouseEvent не включает mouse modality;
- touch/pen down/up/cancel и lost capture вызывают idempotent cleanup;
- mode/space/visibility/disconnect lifecycle;
- cleanup очищает только hover-owned state;
- room hover gate и #152 hit независимы;
- CSS inventory: View hover selectors требуют modality gate, focus-visible — нет.

### Browser smoke

- реальный touch context/CDP touch input: room, device, opening, label, control;
- tap → dialog → close и tap при активном semantic device state;
- browser context с touch и `(any-hover: hover)`;
- two-finger pinch, long press, pointercancel и lost capture;
- touch room click-to-fit #152 без sticky room highlight;
- touch → hardware/simulated mouse pointer: hover снова появляется;
- desktop mouse enter/leave и keyboard Tab/Enter regression;
- Flat/Isometric, kiosk, light/dark и visibility round-trip.

Тест проверяет computed styles и JS state после painted frame, а не только
отсутствие class. `dispatchEvent(new MouseEvent(...))` не заменяет настоящий
touch browser scenario.

### Golden

- touch post-tap screenshot без hover, но с прежним semantic state;
- desktop mouse-hover и keyboard-focus screenshots;
- visual diff не переакцептует unrelated colors/shadows.

### Performance

- pointermove не вызывает full Lit update на каждый пиксель;
- modality gate не добавляет unbounded listeners/observers;
- canonical pan/pinch smoke сохраняет frame responsiveness;
- performance profile перед beta подтверждает отсутствие новых long tasks.

## 14. План реализации

1. Провести inventory JS state и View/shared CSS hover selectors.
2. Ввести component-local pointer modality authority и lifecycle cleanup.
3. Перевести room hover на pointer events с mouse gate.
4. Ввести общий CSS modality gate, разделив hover/focus/semantic rules.
5. Передать modality в обязательные shadow child components.
6. Добавить unit/source-contract и real-touch/hybrid browser tests.
7. Прогнать typecheck, unit и build; перед beta — smoke, golden, performance.

## 15. Документация и release-артефакты

Поскольку bug виден пользователю, implementation commit обязан иметь
`User-Visible: yes` и в том же коммите обновить:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`;
- `docs/TOUCH-SUPPORT.md` — pointer modality и отсутствие sticky hover;
- `docs/CANVAS.md` — hover/pressed/semantic ownership;
- `docs/TESTING.md` — real-touch и hybrid smoke contract.

Нужны reviewed touch post-tap, desktop-hover и keyboard-focus golden artifacts,
а также browser smoke report. Новых пользовательских строк не ожидается; если
появятся, обе локали и parity test обязательны.

## 16. Риски и откат

| Риск | Мера |
| --- | --- |
| Touch cleanup отменяет action | state-only helper, gesture smoke |
| Mouse hover пропадает на hybrid | event-derived transition back to mouse |
| Focus styling попадает под gate | отдельные selectors/source contract |
| Semantic state очищается как hover | явный inventory и state ownership tests |
| Pointermove вызывает rerender storm | DOM gate без full render per move |
| Lifecycle listener течёт | symmetric connect/disconnect test |

Откат возвращает прежние JS/CSS hover paths. Config, storage и backend data не
меняются; миграция и data rollback не нужны.

## 17. Принятые предположения

- `touch` и `pen` следуют одинаковой no-hover policy;
- initial `unknown` не включает pointer-only hover до фактической мыши;
- mouse modality определяется trusted PointerEvent, не compatibility MouseEvent;
- media query используется только вторым gate, а не источником modality;
- #152 room activation не должна читать `_hoverRoom` как selected hit;
- `hp-help`, focus-visible и semantic states не относятся к transient hover.
