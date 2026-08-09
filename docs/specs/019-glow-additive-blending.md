# ТЗ #19 — Аддитивное смешивание Glow-источников

- Issue: https://github.com/Matysh/houseplan-card/issues/19
- Приоритет: P2
- Статус ТЗ: performance-first draft
- Связано: независимый Glow overlay #55 должен сохранить эту композицию

## Цель

Пересекающиеся radial pools смешиваются как свет, а не перекрывают друг друга
по DOM order, без изменения tunnel glow и базового затемнения комнат.

## Render architecture

Внутри lighting layer создаётся отдельная isolated group только для pools:

```css
.glow-pools { isolation: isolate; }
.glow-pool[data-blend='screen'] { mix-blend-mode: screen; }
```

`glow_base`, room/data fill, opening tunnel sectors и sun rays находятся вне
этой group. Порядок остальных SVG layers не меняется. Pool opacity остаётся
частью текущего color/gradient resolver; blend не удваивает base opacity.

## Feature detection и fallback

- Capability определяется один раз per document через
  `CSS.supports('mix-blend-mode','screen')` и кешируется.
- Unsupported engine рендерит текущий normal layering.
- User-agent sniffing и polyfill запрещены.
- Print/screenshot path использует тот же feature decision; reduced motion не
  влияет на статичное blending.

## Performance gate до включения

Добавить deterministic large-light fixture: 1, 10, 30 и 60 overlapping pools.
Сравнить baseline/branch в одном runner по `stateUpdate` p50/p95, render count,
long tasks и screenshot time. Ship gate: p95 delta остаётся внутри действующего
HP-PERF budget и нет устойчивого >10% regression на old kiosk reference
WebView. При провале issue возвращается в research без hidden toggle.

## Визуальная проверка

- warm+cool overlap имеет цвет, отличимый от каждого входа;
- две одинаковые dim лампы дают более светлый overlap без clipping;
- isolated group не осветляет paper/backdrop/room base;
- tunnel sector не screen-blendится с pool;
- результат не зависит от порядка marker в config.

## Приёмка

Golden + sampled pixel assertions доказывают смесь и isolation; unsupported
fallback совпадает с текущим baseline; performance gate зелёный; Glow #55
повторно использует тот же group, не создавая второе смешивание.
