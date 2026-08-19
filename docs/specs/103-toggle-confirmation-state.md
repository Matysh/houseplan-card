# Issue #103 — текущее и ожидаемое состояние в Toggle confirmation

- **Issue:** https://github.com/Matysh/houseplan-card/issues/103
- **Статус документа:** принято ревью ТЗ; реализация разрешена из `S5-ready`
- **Приоритет:** P3
- **Тип:** feature/polish, обычный трек
- **Пользовательское изменение:** да

## 1. Контекст

Универсальный toggle из #94 уже строит один `ResolvedToggleIntent` для hint,
confirmation guard и фактической service call. При `tap_confirm` текущий диалог
показывает только имя цели. Пользователь не видит исходное состояние и
направление команды, особенно у cover/valve и смешанных групп.

Это изменение встречает любую персону House Plan в View на desktop, companion
app или wall panel в момент короткого нажатия на маркер с включённым
`tap_confirm`; поверхность относится к fully-supported safe device actions.

#103 расширяет только содержимое существующего confirmation. Resolver, target
selection, кнопки и safety re-resolve остаются прежними.

## 2. Пользовательский результат

Одиночная цель:

> Переключить «Лампа в прихожей»?
>
> Текущее состояние: Выключено
>
> После переключения: Включено

Группа:

> Текущее состояние: включено 2 из 4
>
> После переключения: все выключены

Строки являются обычным доступным текстом, а не цветом, и читаются до кнопок
Cancel/Confirm.

## 3. Цели

1. Объяснить текущее и ожидаемое состояние каждой исполняемой toggle-команды.
2. Использовать только `ResolvedToggleIntent`, без UI-domain эвристики.
3. Не обещать результат для skipped/unknown целей.
4. Сохранить re-resolve перед service call и target-set race protection #94.

## 4. Не входит в задачу

- изменение resolver, command или service;
- прогноз scripts/scenes и произвольных actions;
- история состояний;
- confirmations удаления/unlock/run и общий dialog redesign #32;
- live-анимация состояния в открытом диалоге;
- изменение `tap_confirm` schema.

## 5. Источник данных

Confirmation snapshot строится из `ResolvedToggleIntent`:

- `targets[].state` и `targets[].name`;
- `kind` и `semantics`;
- `nextEffect`;
- `skippedTargets`;
- stable identity из `sameToggleOperationTargets()`.

`src/device-toggle.ts` остаётся владельцем line selection. Допустимо расширить
`formatToggleIntent()` либо добавить рядом pure `formatToggleConfirmation()`, но
`houseplan-card.ts` не выводит next state по domain самостоятельно.

State label берётся через HA formatter, когда state object доступен. Raw state
допустим только как безопасный fallback; неизвестный будущий результат никогда
не подменяется уверенным On/Off.

## 6. Нормативная матрица

| Intent | Текущее состояние | После переключения |
| --- | --- | --- |
| power `off` + `turn-on` | Выключено | Включено |
| active power + `turn-off` | HA-formatted current | Выключено |
| cover `closed` + `open` | Закрыто | Открыто |
| cover `open` + `close` | Открыто | Закрыто |
| cover `opening/closing` + `stop` | Открывается/Закрывается | Остановлено |
| valve + `open/close` | Закрыто/Открыто | Открыто/Закрыто |
| group, все off | Все выключены | Все включены |
| group, есть active | Включено N из M | Все выключены |
| partial group | доступное подмножество + Недоступно N | результат только command targets |
| `toggle` | HA-formatted current | Состояние определит Home Assistant |
| no operation | confirmation не открывается | — |

Direction всегда следует `nextEffect`; UI не пересчитывает её из текущей строки.

Для группы denominator результата равен числу фактических `targets`, а skipped
выводятся отдельно. Формулировка не обещает, что unavailable/disabled/missing
entities изменятся.

## 7. Dialog state и race

`_tapConfirm` расширяется структурированным snapshot, а не одним HTML string:

```ts
interface TapToggleConfirmation {
  kind: 'toggle';
  title: string;
  lines: string[];
  initialIntent: ResolvedToggleIntent;
  deviceId: string;
  exec: () => void;
}
```

Минимальный обязательный контракт:

- при открытии title/lines фиксируются из initial intent;
- при Confirm текущий device и intent разрешаются заново;
- если operation targets изменились, service call отсутствует и показывается
  существующий `toast.tap_target_changed`;
- если targets прежние, выполняется актуальное direction/command, даже если
  state изменился после открытия;
- dialog snapshot не обязан live-обновлять строки.

`run` confirmation продолжает использовать нынешнюю простую форму. Общий union
не должен заставлять run/delete dialogs притворяться toggle.

## 8. UX, i18n и accessibility

- title сохраняет нынешнее «Переключить …?»;
- current/expected/skipped — отдельные строки/paragraphs;
- long friendly name и group text переносятся без horizontal scroll;
- accessible DOM order: title → current → expected → skipped → buttons;
- смысл не выражается только иконкой/цветом/стрелкой;
- narrow mobile footer сохраняет две доступные кнопки;
- keyboard focus и Escape/scrim contract не меняются.

Минимальные новые RU/EN keys:

- `confirm.current_state`;
- `confirm.expected_state`;
- `confirm.group_current`;
- `confirm.group_all_on` / `confirm.group_all_off`;
- `confirm.unavailable_targets`;
- `confirm.expected_by_ha`;
- state/effect labels, которых ещё нет в общей toggle vocabulary.

Не вводятся plural rules; строки следуют текущему counter-safe style.

## 9. Совместимость и безопасность

- stored `tap_confirm` и config не меняются;
- no-op по-прежнему тихий и не открывает modal;
- secure/disabled/missing filtering остаётся resolver-owned;
- confirmation не исполняет команду из initial snapshot;
- operation target identity проверяется перед actuation;
- virtual-light intent использует тот же current/expected formatter и current
  backend snapshot, не создавая HA service;
- никаких новых permissions или network requests.

## 10. Acceptance criteria

1. Toggle confirmation для operation показывает current и expected lines — **unit + browser smoke**.
2. Expected line строго соответствует `nextEffect` — **unit**.
3. Power, cover, valve, virtual light и group имеют локализованные формулировки — **unit + RU/EN browser smoke**.
4. Partial group явно показывает skipped count и не обещает их изменение — **unit**.
5. `toggle` сообщает, что результат определит HA — **unit**.
6. No-operation intent не открывает confirmation — **unit + browser smoke**.
7. Confirm выполняет заново разрешённый current intent — **browser smoke**.
8. Изменившийся target set отменяет actuation и показывает прежний toast — **browser smoke**.
9. Desktop/mobile layout, keyboard и screen-reader order не регрессируют — **narrow browser smoke + code review**.
10. Run и другие confirmations сохраняют прежнее содержимое — **existing run smoke + code review**.

## 11. План тестирования

### Unit

- pure formatter для каждого `ToggleNextEffect`;
- single power/cover/valve/virtual-light;
- all-off, mixed и partial group;
- formatted current state и raw fallback;
- unknown `toggle` result;
- no-operation returns no confirmation lines;
- EN/RU placeholder parity.

### Integration/browser

- confirmation DOM order на desktop и narrow mobile;
- initial snapshot + state changes + same targets → current command executes;
- changed targets → zero service calls + toast;
- skipped target is not included in command/result promise;
- keyboard focus, Escape, Cancel and scrim;
- run confirmation unchanged.

### Регрессия

- `test/device-toggle.test.mjs`;
- existing HA-controls/toggle smoke;
- typecheck, full unit и build.

Golden не требуется, если modal reflow покрыт narrow render smoke и не меняет
принятый внешний layout. При необходимости добавляется одна deterministic dialog
scene без переакцептации несвязанных baseline.

## 12. План реализации

1. Добавить pure confirmation formatter рядом с resolver.
2. Расширить `_tapConfirm` discriminated state для toggle.
3. Отрисовать semantic lines в текущем dialog.
4. Добавить RU/EN strings и parity tests.
5. Проверить race contract и existing confirmations.

## 13. Документация и release-артефакты

- оба changelog получают user-visible пункт;
- `docs/USER-GUIDE.ru.md` показывает current→expected confirmation;
- `docs/TESTING.md` получает group/race/narrow dialog matrix;
- RU/EN dictionaries меняются в одном implementation commit;
- screenshot/golden — только для точечной modal scene при необходимости;
- backend, migration, performance profile и security artifact не требуются.

## 14. Риски и откат

| Риск | Мера |
| --- | --- |
| Dialog обещает не ту команду | nextEffect-only formatter |
| Initial snapshot исполняется после race | mandatory re-resolve |
| Skipped входят в denominator | separate targets/skipped assertions |
| UI дублирует resolver | pure device-toggle formatter |
| Long group ломает mobile | narrow viewport smoke |

Откат возвращает `_tapConfirm` к одному title string. Config и resolver не
меняются, поэтому data rollback отсутствует.

## 15. Принятые технические предположения

- первая версия показывает snapshot и не live-обновляет открытый dialog;
- current state использует HA formatter при наличии;
- `stop` локализуется как честный ожидаемый effect, не как конечная позиция;
- group result описывает только фактические command targets.
