# Инфраструктура тестов и съёмки

> Приложение к [`docs/TESTING.md`](../TESTING.md): перенесено оттуда дословно (#634).
> Индекс всех приложений — [`README.md`](README.md).

### Issue #73 baseline and implementation (2026-08-11)

The published v1.61.0-beta.6 exact SHA is the renderer baseline for #73: it
contains the accepted visibility-based light model and the matrix-v7 published
baseline; local review fixes prepare matrix-v8 with a semantic warm-pixel gate,
including `lighting-opaque-glow-two-doorways-dark`; canonical light behaviour
is `docs/LIGHT.md`. The owner explicitly started #73 on 2026-08-11.

`test/visual-continuity.test.mjs` covers tokens, quick/long return, delayed
overlay timing, paint barriers and fingerprints. `demo/smoke_visual_continuity.mjs`
samples presented frames and rejects hidden/empty plans, viewport rollback,
overlay over a stale frame, missing production attributes and unbounded or
sensitive trace data. It supplements rather than replaces warm-remount,
websocket-resilience and golden verification.

`npm run continuity:screencast` is the separate compositor-level gate required
before a stable release. It captures acknowledged PNG frames through CDP
`Page.startScreencast`, drives an oscillating multi-frame touch pinch, crops the
real plan stage, requires multiple compositor-presented pinch frames and rejects
uniform, black, white or transparent-looking frame regressions. It writes the
exact frames plus metrics to
`artifacts/continuity-screencast`. Prereleases keep the faster mandatory rAF
smoke; the stable release workflow installs Chromium and runs the screencast
before attaching the public card asset.

The #579 live-viewport witness is split deliberately. `test/live-viewport.test.mjs`
proves that a budget refresh keeps the identity transform, transform origin,
`will-change` and overflow without a demotion; `demo/smoke_live_pan_coverage.mjs`
also holds the pointer through a full Lit commit in flat, isometric and kiosk
modes, then proves terminal cleanup. Before a beta, repeat a physical pinch in
HA Companion on the reported Android WebView: Chromium CDP proves the contract
and records presented frames, but cannot claim that a vendor WebView compositor
has no separate defect.

## Lazy editor runtime and frontend asset tree (#337)

- [ ] A cold configured View reaches a complete interactive frame without any
      request for `houseplan-editor-runtime-*.js`. The first Plan/Devices/
      Background intent requests it once; later editor switches do not repeat
      the request [auto: `smoke_lazy_editor_chunk`].
- [ ] Two failed network requests leave mode, camera and plan in View, show
      the localized retry advice, and the next explicit press starts a fresh
      load cycle that opens the editor once the network is back. A runtime with
      a different build fingerprint is terminal and shows the refresh advice
      (#353) [auto: `editor-runtime-loader.test`, `smoke_lazy_editor_chunk`].
- [ ] A cached stale entry whose main chunk the server no longer lists shows a
      localized "reload the page" panel instead of a silently dead card; hashed
      chunks are served immutable and an orphan chunk on disk fails the bundle
      tree check (#353) [auto: `smoke_entry_stale`, `bundle-assets.test`,
      `test_frontend_assets`].
- [ ] An empty installation requests the dedicated onboarding chunk, displays
      the first-space dialog and still has no editor request. Saving a drawn
      first space requests the editor once and continues into Plan; async
      `getConfigElement()` still returns `houseplan-card-editor`
      [auto: `smoke_lazy_editor_chunk`].
- [ ] `bundle:budget` follows transitive static imports and keeps initial View
      at or below 300000 B gzip (#352: ~10% headroom over the calibrated fact,
      printed with the trend on every run; recalibrated in #367 from 282000 after
      the fact moved 255 993 → 273 697 B, of which +14 KB came in a single step —
      furniture plan-art in the eager graph. Recalibration records the growth, it
      does not fix it: the lever is a lazy graph. A warning fires while headroom
      is still 15000 B, two average features before the wall). Bundle sync, demo freshness, CI artifacts and
      release zip validation fail when any manifest-listed asset is missing or
      its SHA-256 differs [auto: `bundle-assets.test`, `bundle-freshness.test`,
      release-contract tests].

## Съёмка документации запускается с флагами детерминизма (#424)

- [ ] `demo/docs/browser-args.mjs` содержит `--disable-partial-raster` и
      `--run-all-compositor-stages-before-draw` — оба, а не один. По отдельности
      ни один дрейф не убирает: проверено перебором, восемь прогонов на
      конфигурацию.

Первый запрещает переиспользовать ранее нарисованные куски тайла (иначе кадр
зависит от того, что композитор рисовал до него), второй заставляет пройти все
стадии композитора до отрисовки (иначе снимок берётся на полпути). Подпись
дефекта, если он вернётся: один-два случайных кадра из десяти расходятся между
прогонами на единицы пикселей и два уровня, а `--stability=3` при этом зелёный —
внутри одного процесса всё стабильно.

## Воспроизводимость съёмки документации (#410, #422)

Кадр в `docs/images/` обязан зависеть только от коммита. Если он зависит ещё и
от прогона, приёмка скриншотов теряет смысл: «изменилось десять кадров»
перестаёт что-либо означать, и разобрать, продукт это или среда, нечем.

Проверяется по двум осям, и одна не заменяет другую:

- [ ] `node scripts/capture-determinism.mjs` — снимает набор дважды в разных
      процессах и сравнивает хеши. Ловит дрейф **между прогонами** — тот самый,
      что был в #410 (дробная обрезка пересчитывалась от раскладки).
- [ ] `node demo/docs/capture.mjs --stability=3` — три снимка подряд в одном
      процессе и одном состоянии страницы. Ловит дрейф **внутри состояния** —
      анимацию, не успевшую замереть, или зависимость от времени.

Обе команды ничего не принимают и не трогают манифест: это измерение, а не
съёмка. Первая перезаписывает `docs/images` (дважды), поэтому запускать её
удобнее до приёмки, а не после.

Целочисленность обрезки — единственная часть съёмки, которую можно проверить без
браузера: `node --test test/capture-clip.test.mjs`.
