# ТЗ #54 — Диагностический Zigbee topology overlay

- Issue: https://github.com/Matysh/houseplan-card/issues/54
- Приоритет: P2
- Статус ТЗ: research + adapter contract; provider APIs проверяются до кода

## Цель

По явному запросу показать связи ZHA/Zigbee2MQTT между уже размещёнными
устройствами поверх реальной геометрии, не превращая House Plan в редактор сети.

## Stage 0 — capability research

На поддерживаемых версиях HA зафиксировать официальные/фактические API:

- ZHA topology/neighbour source, permissions, direction и LQI semantics;
- Zigbee2MQTT networkmap request/response через HA MQTT integration либо
  документированную exposed entity;
- соответствие IEEE ↔ HA device registry `connections`;
- timeout/rate limits и поведение sleeping end devices.

Неподтверждённые command/topic не hardcode-ятся. Каждый provider имеет fixture
с обезличенными ids и дату/версию проверенного контракта.

## Normalized model

```ts
type ZigbeeTopology = {
  provider: 'zha' | 'z2m'; capturedAt: number;
  nodes: Array<{ key: string; deviceId?: string; role: 'coordinator'|'router'|'end' }>;
  links: Array<{ from: string; to: string; lqi?: number; direction: 'one'|'both'|'unknown' }>;
  warnings: string[];
};
```

Provider adapters живут backend-side либо в изолированном HA adapter; render
не знает API. Browser не подключается к MQTT напрямую и не хранит topology в
House Plan config.

## Fetch/cache/security

- Overlay off по умолчанию; первый toggle запускает fetch с progress/cancel.
- Shared per-provider cache TTL 60 s (уточняется Stage 0), in-flight dedupe и
  hard timeout. Toggle off отменяет UI ожидание, но безопасный backend request
  может завершить cache.
- Refresh только явный или после TTL; HA state ticks не сканируют topology.
- Read permission проверяется backend. Ошибка/unsupported не ломает plan и
  показывает localized status.

## Mapping и визуал

Node сопоставляется marker только через device registry/explicit entity owner.
На plan рисуются links, у которых оба конца имеют видимые live markers текущего
space. Остальные nodes доступны в summary «Не размещено N», но не рисуются.

Edges — pointer-transparent отдельный layer. Цвет/opacity/thickness отражают
нормализованный LQI только при сопоставимой шкале provider; unknown — нейтральный
пунктир. Direction optional arrow только при достоверных данных. Coordinator
и router имеют legend. Geometry стен не интерпретируется как причина сигнала.

## Multiple spaces и lifecycle

Cross-space link не рисуется как линия через разные планы; endpoints получают
badge/count и список другого пространства. Hidden/removed/disabled marker не
рисуется. Rebind refreshes mapping без нового network scan.

## Performance и проверки

- 20/100/500 nodes, dense mesh; edge cap/viewport culling после Stage 0;
- provider fixtures, timeout, malformed/cyclic/duplicate links;
- mapping IEEE/device/entity, cross-space, hidden lifecycle;
- lazy request/in-flight cache and no fetch on ordinary HA ticks;
- golden LQI/unknown legend и performance budget;
- network layer полностью исчезает при toggle off и не меняет config.
