# ТЗ #32 — `hp-confirm` для опасных действий

- Issue: https://github.com/Matysh/houseplan-card/issues/32
- Приоритет: P1
- Статус ТЗ: ready for implementation
- Основа: `src/hp-dialog.ts`

## Цель

Удалить runtime-вызовы browser `confirm()` и дать всем destructive/warning
операциям единый доступный, локализованный и race-safe контракт.

## Компонент и API

`hp-confirm` строится поверх `hp-dialog` и принимает immutable request:

```ts
type ConfirmRequest = {
  id: string;
  kind: 'destructive' | 'warning';
  title: string;
  message: string;
  objectName?: string;
  confirmLabel: string;
  cancelLabel: string;
};
confirm(request): Promise<'confirm' | 'cancel'>;
```

В корневом компоненте находится один controller/queue. Новый request отменяет
предыдущий как `cancel`; stale promise не может применить callback. На
disconnect все pending requests завершаются `cancel`.

## UX

- initial focus всегда Cancel; destructive action визуально отделён и идёт
  последним в DOM;
- Escape/scrim/close = cancel; Enter не подтверждает destructive автоматически;
- заголовок называет операцию, body — объект и необратимые последствия;
- unlock использует `warning`, отдельные тексты и action label, никогда тексты
  удаления;
- touch footer переносится строками без обрезания и horizontal scroll.

## Мигрируемые пути

Удаление draft, draft segment, room, marker/device, plan file и space; unlock.
Каждый caller сначала получает решение, затем заново проверяет существование и
revision объекта перед mutation. Cancel не создаёт undo point и не пишет store.

## Edge cases

Повторный double click, смена space/mode, удаление объекта другим клиентом,
nested dialog, browser back, component disconnect. Повторное подтверждение
одного request id не исполняет действие дважды.

## Проверки и приёмка

- unit controller: confirm/cancel/replacement/disconnect/stale callback;
- browser cancel+accept для каждого класса destructive path и unlock;
- keyboard/focus restore/mobile footer/ru+en long labels;
- `rg "confirm\\(" src` не находит прямых runtime browser calls;
- поведение данных и command stack остаётся прежним.
