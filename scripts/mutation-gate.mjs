#!/usr/bin/env node
// Реестр известных поломок (mutation gate), issue #85.
//
//   node scripts/mutation-gate.mjs --list          мутанты и кого они проверяют
//   node scripts/mutation-gate.mjs --check         патчи применимы к текущему коду
//   node scripts/mutation-gate.mjs                 полный прогон: все мутанты
//   node scripts/mutation-gate.mjs --id=<mutant>   один мутант
//   node scripts/mutation-gate.mjs --build-only    применить и собрать, тест не гонять
//
// Код выхода: 0 — каждый тест поймал свою поломку, 1 — хотя бы один не поймал,
// 2 — не смог проверить (патч не лёг, сборка упала).
//
// Зачем. Зелёный тест в этом проекте несколько раз означал «ничего не
// проверено», и выяснялось это после того, как баг доезжал до владельца:
// смок непрерывности не заметил удаления механизма, который защищает; golden,
// заведённый под #71, был пуст — 1 177 тёплых пикселей против 107 119, и все
// 1 177 были иконками. Общее у всех случаев: тест ни разу не проверяли на
// способность падать. Этот гейт делает такую проверку регулярной.
//
// Каждый мутант — маленький патч продуктового исходника, воспроизводящий
// известную поломку, и имя теста, который ОБЯЗАН на ней покраснеть. Прогон:
// worktree → патч → сборка бандла → бандл в demo/srv/assets → тест. Тест,
// оставшийся зелёным, — это провал гейта, а не успех теста.
//
// Прогон дорогой (пересборка бандла на мутанта), поэтому его место — перед
// стабильным релизом (.github/workflows/mutation-gate.yml), не на каждой бете.
// Дешёвая часть — «патчи применимы, guard-файлы существуют» — живёт в
// test/mutation-gate.test.mjs и идёт с обычными юнитами: реестр, отставший от
// кода, хуже отсутствующего, потому что выглядит защитой.

import { spawnSync } from 'node:child_process';
import {
  cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// --- реестр ---------------------------------------------------------------
// `find` обязан встречаться в файле ровно один раз: патч, который ложится «куда
// попало», проверяет не то, что объявлен проверять. Это контролирует --check.
export const MUTANTS = [
  {
    id: 'chain-thickness-falls-back-to-default',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="chainSegmentCms fills a gap" '
      + 'test/wall-face-graph.test.mjs',
    because: 'a segment whose thickness was not recorded must inherit the previous segment of '
      + 'its own chain — the value the person watched on screen — instead of the global default '
      + 'that silently replaced 30 cm with 15 cm in the stored plan (#234)',
    patches: [{
      file: 'src/wall-face-graph.ts',
      find: '    const cm = own ?? previous ?? fallbackTail;',
      replace: '    const cm = own ?? fallbackTail;',
    }],
  },
  {
    id: 'chain-thickness-preview-diverges',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="owns no fallback of its own" '
      + 'test/wall-face-graph.test.mjs',
    because: 'the preview and every writer must read one resolver; two formulas for one meaning '
      + 'is what let the editor show 30 cm while the config kept 15 (#234)',
    patches: [{
      file: 'src/wall-face-graph.ts',
      find: '    result.push({ a: [a[0], a[1]], b: [b[0], b[1]], cm: cms[i] });',
      replace: '    result.push({ a: [a[0], a[1]], b: [b[0], b[1]], '
        + 'cm: Number.isFinite(cms[i]) && cms[i] >= 0 ? cms[i] : 15 });',
    }],
  },
  {
    id: 'chain-thickness-length-invariant-dropped',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="always returns exactly segmentCount" '
      + 'test/wall-face-graph.test.mjs',
    because: 'the resolver must return one thickness per segment for any input: the array drifting '
      + 'shorter than the path is the mechanism that produced the whole defect (#234)',
    patches: [{
      file: 'src/wall-face-graph.ts',
      find: '  for (let i = 0; i < count; i++) {',
      replace: '  for (let i = 0; i < Math.min(count, (recorded?.length ?? 0)); i++) {',
    }],
  },
  {
    id: 'smoke-launcher-skips-freshness',
    guard: 'node --test --test-name-pattern="launcher enforces the gate" '
      + 'test/bundle-freshness.test.mjs',
    because: 'a smoke run against a stale demo bundle does not fail cleanly — on #234 three '
      + 'assertions went red while a fourth went green, because the old code was wrong in two '
      + 'places that agreed with each other, and the mixed result reads as a logic defect (#236)',
    patches: [{
      file: 'demo/serve.mjs',
      find: '  await assertFreshDemoBundleUnlessAllowed(page, REPO_ROOT);',
      replace: '  // freshness intentionally skipped by the mutant',
    }],
  },
  {
    id: 'resize-labels-show-centreline',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="innerEdgeSpan measures between wall faces" '
      + 'test/wall-thickness.test.mjs',
    because: 'resize labels must report the distance a person measures with a tape between wall '
      + 'faces; centreline numbers cannot be checked against anything and sat next to an area '
      + 'that was already computed from the floor (#233)',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '  const span = end - start;',
      replace: '  const span = centre;',
    }],
  },
  {
    id: 'inner-span-ignores-neighbour-thickness',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="innerEdgeSpan measures between wall faces" '
      + 'test/wall-thickness.test.mjs',
    because: 'an edge is cut by the inner faces of its NEIGHBOURS, not by its own thickness: a '
      + 'thin side between two thick walls loses 2x15, not 2x7.5, and reading own thickness at '
      + 'both ends gives a number no tape measure confirms (#233 AC2)',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '    const o = Math.max(0, Number(offsets[edge]) || 0);',
      replace: '    const o = own;',
    }],
  },
  {
    id: 'inner-span-shortens-a-passage',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="keeps the centreline where there is no wall" '
      + 'test/wall-thickness.test.mjs',
    because: 'a passage has no face to measure from, and insetContour leaves that joint as a flat '
      + 'cap, so shortening an open side would split length from area again at a new boundary '
      + '(#233, spec review r1/H1)',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '  if (!(own > 0)) return centre;',
      replace: '  if (false) return centre;',
    }],
  },
  {
    id: 'inner-span-reads-whole-edge-thickness',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="ownEdgeOffsets reads the atomic profile" '
      + 'test/wall-thickness.test.mjs',
    because: 'thicknessCmAt returns 0 for a whole-edge query against a partially set thickness, so '
      + 'reading it instead of the atomic profile would silently stop shortening split-thickness '
      + 'edges (#233, spec review r1/H2)',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '      if (distToSeg(mid[0], mid[1], p0[0], p0[1], p1[0], p1[1]) <= eps) {',
      replace: '      if (false) {',
    }],
  },
  {
    id: 'snapn-returns-input-near-node',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="snapN returns the exact nearest node" '
      + 'test/align-grid.test.mjs',
    because: 'explicit Optimize must replace a stored ULP tail with the exact nearest grid node '
      + 'instead of preserving the noisy input merely because its displacement is visually tiny',
    patches: [{
      file: 'src/align-grid.ts',
      find: '  return Math.round(v / GRID_STEP_N) * GRID_STEP_N;',
      replace: '  const s = Math.round(v / GRID_STEP_N) * GRID_STEP_N;\n'
        + '  return Math.abs(s - v) <= EPS ? v : s;',
    }],
  },
  {
    id: 'union-quantization-removed',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="boolean input normalization|six-room ULP" '
      + 'test/physical-geometry.test.mjs',
    because: 'ordinary split/merge double tails must collapse at the shared boolean boundary '
      + 'instead of making one room erase every Glow clip in its space',
    patches: [{
      file: 'src/physical-geometry.ts',
      find: '    const qx = Math.round(x / step) * step;\n'
        + '    const qy = Math.round(y / step) * step;',
      replace: '    const qx = x;\n    const qy = y;',
    }],
  },
  {
    id: 'union-failure-kills-space',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="malformed room|fallback unions overlapping" '
      + 'test/physical-geometry.test.mjs',
    because: 'one room rejected by polyclip must be skipped locally while every healthy floor '
      + 'fragment remains clipped and visible rather than failing the whole space dark',
    patches: [{
      file: 'src/physical-geometry.ts',
      find: '  return intersectionPathsByBound(base, bounds, options);',
      replace: '  return [];',
    }],
  },
  {
    id: 'union-failure-silent',
    guard: 'node demo/smoke_glow_geometry_resilience.mjs',
    because: 'a residual per-room geometry fallback must leave one redacted, deduplicated '
      + 'space/room diagnostic instead of silently looking like a broken Glow setting',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    console.warn(\n'
        + '      `HOUSEPLAN GLOW GEOMETRY FALLBACK: #218, space ${spaceId}, room ${roomId}, phase ${phase}`,\n'
        + '    );',
      replace: '    if (false) console.warn(\n'
        + '      `HOUSEPLAN GLOW GEOMETRY FALLBACK: #218, space ${spaceId}, room ${roomId}, phase ${phase}`,\n'
        + '    );',
    }],
  },
  {
    id: 'glow-fail-dark-weakened',
    guard: 'node demo/smoke_glow_fail_dark.mjs',
    because: 'resilient floor clipping must not revive a source embedded in opaque masonry; '
      + 'the existing source guard remains a release-blocking fail-dark boundary',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '      if (pointInOpaquePlanBody(sourcePoint, masonryGeometry, opaqueBodies)) {',
      replace: '      if (false && pointInOpaquePlanBody(sourcePoint, masonryGeometry, opaqueBodies)) {',
    }],
  },
  {
    id: 'optimizer-micro-interval-cleanup-disabled',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="isolated thickness micro-interval" '
      + 'test/plan-optimizer.test.mjs',
    because: 'explicit Optimize must remove only the proven sub-half-step 22→15→22 '
      + 'artefact instead of continuing to call the lossy plan canonical',
    patches: [{
      file: 'src/plan-optimizer.ts',
      find: '  if (!walls?.length) return [];\n  const scale = coordScale > 0 ? coordScale : 1;\n'
        + '  const eps = Math.max(pitch * scale * 0.02, 1e-9);',
      replace: '  if (!walls?.length) return [];\n  return walls.slice();\n'
        + '  const scale = coordScale > 0 ? coordScale : 1;\n'
        + '  const eps = Math.max(pitch * scale * 0.02, 1e-9);',
    }],
  },
  {
    id: 'atomic-child-thickness-parent-fallback',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="exact parent|atomic solid children" '
      + 'test/wall-thickness.test.mjs test/open-spans.test.mjs',
    because: 'closing a fully virtual stretch beside an atomised exact parent run must inherit '
      + 'the real neighbouring thickness instead of silently writing the 15 cm default',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '  const exact = exactCoveringWall(walls, a, b, pitch, coordScale);',
      replace: '  const exact = false ? exactCoveringWall(walls, a, b, pitch, coordScale) : null;',
    }],
  },
  {
    id: 'stale-space-position-guard-removed',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="stable space ids" test/optional-space-model-contract.test.mjs',
    because: 'position persistence with a stable space id must fail closed before layout, dirty-set '
      + 'and websocket side effects when that space has been deleted or renamed',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    if (!this._spaceModelById(d.space)) return;\n    if (this._norm) {',
      replace: '    if (this._norm) {',
    }],
  },
  {
    id: 'fixed-floor-transition-guard-bypassed',
    guard: 'node demo/smoke_fixed_floor.mjs',
    because: 'a fixed card must reject tabs and every internal active-space mutation instead of '
      + 'showing another floor after the initial resolver selected the configured one',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    if (authority || !this._hasFixedFloor) return true;',
      replace: '    if (authority || this._hasFixedFloor) return true;',
    }],
  },
  {
    id: 'empty-space-cleanup-disabled',
    guard: 'node demo/smoke_optional_space_model.mjs',
    because: 'удаление последнего пространства обязано завершать жесты, редакторы и отложенную запись; '
      + 'смок дважды переводит живую карточку в пустой план и проверяет реальный lifecycle cleanup',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: 'if (this._emptySpaceStateActive) return;',
      replace: 'if (empty) return;',
    }],
  },
  {
    id: 'continuity-long-resume-noop',
    guard: 'node demo/smoke_visual_continuity.mjs',
    because: 'смок обязан доказывать, что long-resume СРАБОТАЛ (токен ушёл вперёд), '
      + 'а не что ничего не спрятали: в beta.7 он не заметил удаления всего механизма',
    patches: [{
      file: 'src/visual-continuity.ts',
      find: "if (!signal.long && (signal.kind === 'visible' || signal.kind === 'pageshow')) {",
      replace: "if ((signal.kind === 'visible' || signal.kind === 'pageshow')) {",
    }],
  },
  {
    id: 'opening-cut-degenerate',
    guard: 'node demo/smoke_glow.mjs',
    because: 'проём, выродившийся в точку, остаётся кладкой — свет перестаёт '
      + 'проходить через дверь; смок обязан это увидеть по освещённому полу за проёмом',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: 'cuts.push([opening.x - dx, opening.y - dy, opening.x + dx, opening.y + dy]);',
      replace: 'cuts.push([opening.x, opening.y, opening.x, opening.y]);',
    }],
  },
  {
    id: 'registryless-opening-requires-registry-row',
    guard: 'node demo/smoke_registryless_opening.mjs',
    because: 'возврат требования Entity Registry row снова делает выбранную YAML-сущность '
      + 'невидимой в painted frame; smoke обязан доказать contact, lock и frozen-snapshot parity',
    patches: [{
      file: 'src/ha-binding-status.ts',
      find: '  return !!entityId\n    && !!projectedHass?.states?.[entityId];',
      replace: '  return !!entityId\n    && !!projectedHass?.entities?.[entityId]\n'
        + '    && !!projectedHass?.states?.[entityId];',
    }],
  },
  {
    id: 'column-shadow-removed',
    guard: 'node demo/smoke_glow.mjs',
    because: 'физические тела выпали из окклюдеров — колонна перестаёт отбрасывать '
      + 'тень; исторически смок теней был зелёным, пока тени физически не рисовались',
    patches: [{
      file: 'src/houseplan-card.ts',
      // Physical bodies now enter the canonical masonry union. Mutating only
      // its legacy fallback is a no-op on every valid thick-wall fixture.
      find: 'this._wallKeyPitch, this._cellCm, this._gridPitch, NORM_W, lightPhysical,',
      replace: 'this._wallKeyPitch, this._cellCm, this._gridPitch, NORM_W, [],',
    }],
  },
  {
    id: 'feather-20px',
    guard: 'node demo/smoke_glow.mjs',
    because: 'растушёвка 20 px вместо 2 размывает границу света на полкомнаты; '
      + 'смок читает data-feather-px и обязан отвергнуть значение больше 3',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: 'const GLOW_EDGE_FEATHER_PX = 2;',
      replace: 'const GLOW_EDGE_FEATHER_PX = 20;',
    }],
  },
  {
    id: 'barrier-cache-never-invalidated',
    guard: 'node demo/smoke_openwall.mjs',
    because: 'кэш барьеров, который не инвалидируется по содержимому, — это свет '
      + 'сквозь стену, которая уже существует; смок переключает виртуальную границу '
      + 'и обязан увидеть смену освещённости соседней комнаты',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: 'if (this._lightBarrierCache?.key === cacheKey) return this._lightBarrierCache.value;',
      replace: 'if (this._lightBarrierCache) return this._lightBarrierCache.value;',
    }],
  },
  {
    id: 'golden-lamp-out-of-reach',
    guard: 'node demo/golden/run.mjs --mode=capture --scenario=lighting-opaque-glow-two-doorways-dark',
    because: 'сцена заведена как защита дверного света (#71) и однажды уже была '
      + 'пустой: лампа стояла так, что пятно не доходило до стены. Уведённая лампа '
      + 'обязана ронять семантический ассерт warmPixelRegion, а не только пиксельный дифф. '
      + 'Режим capture, а не verify: политика запрещает verify по одной сцене '
      + '(demo/golden/policy.mjs) — частичный verify это лазейка «чтобы CI позеленел». '
      + 'На capture семантический провал даёт status error, и goldenRunFailed '
      + 'краснеет в любом режиме — то есть проверка сохраняется полностью',
    // Мутируется фикстура сцены, не продуктовый код: пустота сцены — свойство
    // фикстуры. Пересборка бандла всё равно нужна, путь тот же.
    patches: [{
      file: 'demo/golden/matrix.mjs',
      find: "layoutOverrides: { 'golden-light-one': { s: 'golden-lighting', x: 0.40, y: 0.48 } },",
      replace: "layoutOverrides: { 'golden-light-one': { s: 'golden-lighting', x: 0.06, y: 0.90 } },",
    }],
  },
  {
    id: 'golden-filled-tunnel-removed',
    guard: 'node demo/golden/run.mjs --mode=capture --scenario=openings-filled-tunnel-dark',
    because: 'сцена защищает непрерывную room-coloured заливку толстого тоннеля (#81): '
      + 'если fixture перестаёт рисовать заливку, semantic tunnelContinuity обязан упасть, '
      + 'а не принять пустой проём как корректный golden',
    // Ломаем только заявленное условие fixture. Capture сохраняет полный
    // semantic gate даже для одной сцены и не зависит от pixel baseline.
    patches: [{
      file: 'demo/golden/matrix.mjs',
      find: "{ id: 'openings-filled-tunnel-dark', fixture: 'visual', space: 'golden-lighting', mode: 'view',\n    fillMode: 'custom', customFill: { c: '#66717c', a: 0.55 }, glowEnabled: false,",
      replace: "{ id: 'openings-filled-tunnel-dark', fixture: 'visual', space: 'golden-lighting', mode: 'view',\n    fillMode: 'none', customFill: { c: '#66717c', a: 0.55 }, glowEnabled: false,",
    }],
  },
  {
    id: 'sun-north-subtraction-restored',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="planSunAngle" test/sun.test.mjs',
    because: 'возврат старого azimuth - northDeg снова зеркалит направление при '
      + 'ненулевом севере; табличный AC-01 обязан покраснеть на 90+90 и wrap-кейсах',
    patches: [{
      file: 'src/sun.ts',
      find: 'return norm360(azimuth + northDeg);',
      replace: 'return norm360(azimuth - northDeg);',
    }],
  },
  {
    id: 'sun-to-sun-vector-inverted',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="north right plus east sun" test/sun.test.mjs',
    because: 'формула угла остаётся правильной, но инверсия toSun выбирает окно с '
      + 'противоположной стороны; направленный AC-03 обязан отличить окно от направления луча',
    patches: [{
      file: 'src/sun.ts',
      find: '  const toSun = sunDirOnPlan(azimuth, northDeg);\n  const away: [number, number] = [-toSun[0], -toSun[1]];',
      replace: '  const direction = sunDirOnPlan(azimuth, northDeg);\n  const toSun: [number, number] = [-direction[0], -direction[1]];\n  const away: [number, number] = [-toSun[0], -toSun[1]];',
    }],
  },
  {
    id: 'sun-golden-north-neutralized',
    guard: 'node --test --test-name-pattern="sun-ray golden" test/golden-matrix.test.mjs',
    because: 'нулевой north_deg снова делает golden нечувствительным к знаку композиции; '
      + 'структурный тест обязан требовать ненулевой север и асимметричный азимут',
    patches: [{
      file: 'demo/golden/matrix.mjs',
      find: '    glowEnabled: false, allLightsOff: true, northDeg: 90,',
      replace: '    glowEnabled: false, allLightsOff: true, northDeg: 0,',
    }],
  },
  {
    id: 'plan-only-room-area-restored',
    guard: 'node scripts/backend-test-guard.mjs plan_only_export_projects',
    because: 'возврат room.area нарушает основное обещание чистого шаблона; '
      + 'projection/roundtrip тест обязан увидеть HA Area даже при нулевых markers',
    patches: [{
      file: 'custom_components/houseplan/import_export.py',
      find: '_ROOM_PLAN_FIELDS = ("id", "name", "open_to", "x", "y", "w", "h", "poly")',
      replace: '_ROOM_PLAN_FIELDS = ("id", "name", "area", "open_to", "x", "y", "w", "h", "poly")',
    }],
  },
  {
    id: 'plan-only-projector-bypassed',
    guard: 'node scripts/backend-test-guard.mjs plan_only_export_projects',
    because: 'игнорирование request-флага возвращает markers и device layout; '
      + 'полный representative export обязан доказать, что true включает lossy projector',
    patches: [{
      file: 'custom_components/houseplan/import_export.py',
      find: '        if plan_only:\n            projected_space = _project_plan_only_space(space)',
      replace: '        if False and plan_only:\n            projected_space = _project_plan_only_space(space)',
    }],
  },
  {
    id: 'ordinary-export-plan-only-false-emitted',
    guard: 'node scripts/backend-test-guard.mjs ordinary_space_export_is_unchanged',
    because: 'аддитивное поле не должно менять обычный space export даже значением false; '
      + 'fixed regression обязан сохранить прежнюю структуру документа',
    patches: [{
      file: 'custom_components/houseplan/import_export.py',
      find: '**({"plan_only": True} if plan_only else {}),',
      replace: '**({"plan_only": plan_only}),',
    }],
  },
  {
    id: 'plan-only-revalidate-flag-dropped',
    guard: 'node scripts/backend-test-guard.mjs plan_only_export_projects',
    because: 'revalidate не имеет права превращать plan-only preview в обычный space preview; '
      + 'roundtrip test проверяет сохранение флага после обновления revisions',
    patches: [{
      file: 'custom_components/houseplan/import_export.py',
      find: '            "plan_only": _transfer_plan_only(document),\n            "counts":',
      replace: '            "plan_only": False,\n            "counts":',
    }],
  },
  {
    id: 'plan-only-forged-file-trusted',
    guard: 'node scripts/backend-test-guard.mjs forged_plan_only_privacy_claim',
    because: 'флаг файла не является доказательством приватности; negative parser matrix '
      + 'обязана покраснеть, если schema-aware проверка больше не вызывается',
    patches: [{
      file: 'custom_components/houseplan/import_export.py',
      find: '    if plan_only:\n        _validate_plan_only_document(document, config, layout, placement)',
      replace: '    if False and plan_only:\n        _validate_plan_only_document(document, config, layout, placement)',
    }],
  },
  {
    id: 'plan-only-preview-label-hidden',
    guard: 'node demo/smoke_backup_transfer.mjs',
    because: 'валидный plan-only файл без явной строки в preview выглядит обычной копией; '
      + 'browser smoke обязан проверять пользовательский статус, а не только backend-флаг',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: "${p.plan_only ? html`<span class=\"backupplanonlystatus\">${this._t('backup.plan_only_preview')}</span>` : nothing}",
      replace: "${false ? html`<span class=\"backupplanonlystatus\">${this._t('backup.plan_only_preview')}</span>` : nothing}",
    }],
  },
  {
    id: 'passage-visible-geometry-door-fallback',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test test/opening-symbol.test.mjs',
    because: 'если явную пустую ветку passage убрать, общий fallback рисует дверную створку; '
      + 'renderer test обязан требовать буквально пустую видимую геометрию',
    patches: [{
      file: 'src/render/opening-symbol.ts',
      find: "  if (spec.type === 'passage') return svg``;",
      replace: "  if (false && spec.type === 'passage') return svg``;",
    }],
  },
  {
    id: 'passage-light-classifier-removed',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test test/light-visibility.test.mjs',
    because: 'потеря passage из явного allowlist снова делает внутренний открытый проём '
      + 'непрозрачным; тест одновременно сохраняет fail-dark для неизвестных типов',
    patches: [{
      file: 'src/logic.ts',
      find: "  return type === 'door' || type === 'gate' || type === 'passage';",
      replace: "  return type === 'door' || type === 'gate';",
    }],
  },
  {
    id: 'passage-import-validator-bypassed',
    guard: 'node scripts/backend-test-guard.mjs invalid_passage_import',
    because: 'импорт является недоверенным новым content и не имеет broken-read исключения; '
      + 'forged contact/lock обязан быть отклонён до создания preview',
    patches: [{
      file: 'custom_components/houseplan/import_export.py',
      find: '        validate_opening_passages(incoming_config, validate_all=True)',
      replace: '        if False:\n            validate_opening_passages(incoming_config, validate_all=True)',
    }],
  },
  {
    id: 'passage-static-door-cut-leak',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test test/space-geometry.test.mjs',
    because: 'Static обязан менять masonry только для нового passage; добавление обычной двери '
      + 'в cuts сломает сохранённую совместимость старых планов',
    patches: [{
      file: 'src/space-geometry.ts',
      find: "    if (opening?.type !== 'passage') continue;",
      replace: "    if (opening?.type !== 'passage' && opening?.type !== 'door') continue;",
    }],
  },
  {
    id: 'passage-iso-door-fallback',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test test/iso-openings.test.mjs',
    because: 'без zero-leaf branch скрытая изометрия превращает passage в дверь; '
      + 'basis test обязан ловить любое появление панели независимо от live state',
    patches: [{
      file: 'src/iso-openings.ts',
      find: "  if (input.type === 'passage') {",
      replace: "  if (false && input.type === 'passage') {",
    }],
  },
  {
    id: 'entity-marker-kept-in-parent-device',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="entity marker owns its entity|partial auto parent" '
      + 'test/devices.test.mjs',
    because: 'an explicitly placed entity must be removed from the residual automatic parent '
      + 'so state, action and light projection cannot render the same HA channel twice',
    patches: [{
      file: 'src/devices.ts',
      find: '      !owned.has(entityId) && !hass?.entities?.[entityId]?.hidden),',
      replace: '      !hass?.entities?.[entityId]?.hidden),',
    }],
  },
  {
    id: 'entity-marker-parent-seeded',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="seedHiddenBindings: entity ownership" '
      + 'test/devices.test.mjs',
    because: 'the first-run seeder must share residual ownership with buildDevices or it can '
      + 'materialise the removed automatic duplicate as a permanent hidden device marker',
    patches: [{
      file: 'src/devices.ts',
      find: '  const entsBy = entitiesByDevice(h);\n'
        + '  const ownership = entityMarkerOwnership(markers, fullHass);\n'
        + '  const marked = new Set(markers.map((m) => m.binding));',
      replace: '  const entsBy = entitiesByDevice(h);\n'
        + '  const ownership = entityMarkerOwnership([], fullHass);\n'
        + '  const marked = new Set(markers.map((m) => m.binding));',
    }],
  },
  {
    id: 'manual-room-device-area-fallback',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="manual room without area.*device" test/devices.test.mjs',
    because: 'возврат старого device fallback снова даёт registry Area приоритет над явно '
      + 'сохранённой комнатой без HA Area; AC1 обязан увидеть неверные area и space',
    patches: [{
      file: 'src/devices.ts',
      find: '      const { area, space } = resolveExplicitMarkerPlacement(\n'
        + '        m, dev?.area_id, areaToSpace, firstSpaceId,\n'
        + '      );',
      replace: "      const area = m.area || dev?.area_id || '';\n"
        + '      const space = (area && areaToSpace[area]) || m.space || firstSpaceId;',
    }],
  },
  {
    id: 'manual-room-entity-branch-skipped',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="manual room without area.*entity" test/devices.test.mjs',
    because: 'исправление только device-ветки оставляет entity Area и Area родительского '
      + 'устройства способными увести маркер из ручной комнаты; AC2 покрывает оба пути',
    patches: [{
      file: 'src/devices.ts',
      find: '      const { area, space } = resolveExplicitMarkerPlacement(\n'
        + '        m, registryArea, areaToSpace, firstSpaceId,\n'
        + '      );',
      replace: "      const area = m.area || registryArea || '';\n"
        + '      const space = (area && areaToSpace[area]) || m.space || firstSpaceId;',
    }],
  },
  {
    id: 'area-null-without-room-id-hijacked',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="area null without room_id" test/devices.test.mjs',
    because: 'одно area:null не доказывает ручную комнату: расширенный предикат угоняет '
      + 'legacy marker без room_id из registry Area; негативный AC3 обязан это поймать',
    patches: [{
      file: 'src/devices.ts',
      find: "  const manualRoomWithoutArea = typeof marker.room_id === 'string'\n"
        + '    && marker.room_id.length > 0\n'
        + '    && marker.area === null;',
      replace: '  const manualRoomWithoutArea = marker.area === null;',
    }],
  },
  {
    id: 'reopened-room-from-registry-space',
    guard: 'node demo/smoke_subarea.mjs',
    because: 'room_id без правильного effective space создаёт отсутствующую option при '
      + 'повторном открытии; browser smoke обязан восстановить точный garden#@room id',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: "          ? d.space + '#@' + d.marker.room_id",
      replace: "          ? this._space + '#@' + d.marker.room_id",
    }],
  },
  {
    id: 'same-space-room-change-recenters',
    guard: 'node demo/smoke_subarea.mjs',
    because: 'редактирование комнаты внутри одного пространства не должно двигать уже '
      + 'расставленный маркер; smoke сравнивает закреплённые координаты до и после Save',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '      if (!replacingRemoved && prevPos && prevPos.s === targetSpaceId) {',
      replace: '      if (!replacingRemoved && prevPos && prevPos.s === targetSpaceId && !roomChanged) {',
    }],
  },
  {
    id: 'hidden-room-names-full-svg-fallback',
    guard: 'node demo/smoke_hide_room_names.mjs',
    because: 'show_names:false must remove every permanent label from the full flat renderer; '
      + 'the smoke must reject the legacy centred SVG substitute independently of compact and iso',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: "            ${this._renderOpeningTunnelFills(space, glowBase, 'glow-base')}\n"
        + '            ${glowLayerVisible ? this._renderGlowLayer(space, disp) : nothing}',
      replace: "            ${this._renderOpeningTunnelFills(space, glowBase, 'glow-base')}\n"
        + '            ${!space.bg && !disp.showNames && !this._markup ? svg`<g class="room-svg-labels" pointer-events="none">${space.rooms.map((room) => {\n'
        + '              const center = this._roomCenter(room);\n'
        + '              return svg`<text class="rlabel" data-hp="room-label" data-id=${room.id || nothing}\n'
        + '                data-area=${room.area || nothing} x=${center[0]} y=${center[1]}>${room.name}</text>`;\n'
        + '            })}</g>` : nothing}\n'
        + '            ${glowLayerVisible ? this._renderGlowLayer(space, disp) : nothing}',
    }],
  },
  {
    id: 'hidden-room-names-compact-svg-fallback',
    guard: 'node demo/smoke_hide_room_names.mjs',
    because: 'the compact card is an independent renderer and must not replace a disabled HTML '
      + 'room card with the old SVG name even when the full card is correct',
    patches: [{
      file: 'src/space-render.ts',
      find: '  spaceModels, defaultPositions, markerPos, labelPos, spaceFrame, iconCqw, NORM_W,',
      replace: '  spaceModels, roomCenter, defaultPositions, markerPos, labelPos, spaceFrame, iconCqw, NORM_W,',
    }, {
      file: 'src/space-render.ts',
      find: '        ${passageGlowTunnels}\n        ${wallUnion',
      replace: '        ${passageGlowTunnels}\n'
        + '        ${!space.bg && !disp.showNames ? svg`<g class="room-svg-labels" pointer-events="none">${space.rooms.map((room) => {\n'
        + '          const center = roomCenter(room);\n'
        + '          return svg`<text class="rlabel" data-hp="room-label" data-id=${room.id || nothing}\n'
        + '            data-area=${room.area || nothing} x=${center[0]} y=${center[1]}>${room.name}</text>`;\n'
        + '        })}</g>` : nothing}\n'
        + '        ${wallUnion',
    }],
  },
  {
    id: 'hidden-room-names-iso-override',
    guard: 'node demo/smoke_hide_room_names.mjs',
    because: 'hidden isometric View must obey the same show_names:false contract instead of '
      + 'forcing an HTML room card solely because the space has no backdrop',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '            ${disp.showNames || this._markup\n',
      replace: '            ${disp.showNames || (iso && !space.bg) || this._markup\n',
    }],
  },
  {
    id: 'plan-room-area-icon-hidden',
    guard: 'node demo/smoke_room_link.mjs',
    because: 'Plan обязан сохранять тот же состав name-row, что и View; возврат прежнего '
      + 'условия снова убирает Area icon и сдвигает подпись относительно anchor',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    const showAreaLink = !!r.area;',
      replace: '    const showAreaLink = !this._markup && !!r.area;',
    }],
  },
  {
    id: 'plan-room-area-icon-navigates',
    guard: 'node demo/smoke_room_link.mjs',
    because: 'Area icon в Plan является частью drag-зоны, а не ссылкой; включение View-handlers '
      + 'обязано одновременно проявиться навигацией и невозможностью начать drag с иконки',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    const areaLinkInteractive = !this._markup;',
      replace: '    const areaLinkInteractive = true;',
    }],
  },
  {
    id: 'space-create-hidden-display-override',
    guard: 'node demo/smoke_space_create_display_defaults.mjs',
    because: 'Save must persist the two booleans visibly chosen for a new hand-drawn space; '
      + 'the production smoke saves and reopens a mixed pair so the old hidden true/true override cannot return',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '        show_borders: d.showBorders,\n        show_names: d.showNames,',
      replace: "        show_borders: d.source === 'draw' && d.mode === 'create' ? true : d.showBorders,\n"
        + "        show_names: d.source === 'draw' && d.mode === 'create' ? true : d.showNames,",
    }],
  },
  {
    id: 'vacuum-trail-resume-disabled',
    guard: 'node scripts/trail-resume-test-guard.mjs',
    because: 'an ended same-map run inside the accepted 30-minute window must reopen instead '
      + 'of rotating into previous; focused pure and recorder sequences must reject the old unconditional split',
    patches: [{
      file: 'custom_components/houseplan/trails.py',
      find: '        resumed = bool(cur and can_resume_trail_run(cur, map_id, now))',
      replace: '        resumed = False',
    }],
  },
  {
    id: 'device-unavailable-hover-restored',
    guard: 'node demo/smoke_device_icon_design.mjs',
    because: 'unavailable keeps click/keyboard access but must never regain the blue visual hover '
      + 'which makes an offline device look live',
    patches: [{
      file: 'src/styles.ts',
      find: '.dev:not(.unavail):hover {',
      replace: '.dev.unavail:hover {',
    }],
  },
  {
    id: 'device-marker-lqi-low-boundary-shifted',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="marker LQI keeps semantic bands" '
      + 'test/device-presentation.test.mjs',
    because: 'marker LQI must keep the owner-approved inclusive <=40 red boundary without '
      + 'changing the separate room-fill gradient',
    patches: [{
      file: 'src/device-presentation.ts',
      find: '  if (lqi <= 40) return \'low\';',
      replace: '  if (lqi < 40) return \'low\';',
    }],
  },
  {
    id: 'device-long-value-ellipsis-restored',
    guard: 'node demo/smoke_device_icon_design.mjs',
    because: 'Text and Double must expose the complete dynamic value; the new shared shell '
      + 'must not regress to the old clipped satellite',
    patches: [{
      file: 'src/styles.ts',
      find: '    .dev .valtext {\n      overflow: visible;',
      replace: '    .dev .valtext {\n      overflow: hidden;\n      text-overflow: ellipsis;',
    }],
  },
  {
    id: 'device-keyboard-bypasses-click-path',
    guard: 'node demo/smoke_device_icon_design.mjs',
    because: 'Enter and Space must reuse the current surface click path so Device editor opens '
      + 'settings and secure View actions keep their existing confirmation policy',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    this._clickDevice(ev, d);',
      replace: '    if (d.primary) this._openMoreInfo(d.primary);',
    }],
  },
  {
    id: 'device-visual-factor-removed',
    guard: 'node --test --test-name-pattern="issue 213 resolves the effective base" '
      + 'test/device-marker-polish-contract.test.mjs',
    because: 'the current effective size must be resolved once at the surface boundary; '
      + 'restoring a late face-level 0.9 factor would shrink every marker a second time',
    patches: [{
      file: 'src/styles.ts',
      find: '      --dev-size: calc(var(--device-base-size, 2.25cqw) * var(--dev-scale, 1));',
      replace: '      --dev-size: calc(var(--device-base-size, 2.25cqw) * var(--dev-scale, 1) * 0.9);',
    }],
  },
  {
    id: 'device-text-capsule-radius-restored',
    guard: 'node --test --test-name-pattern="issue 212 Text value" '
      + 'test/device-marker-polish-contract.test.mjs',
    because: 'a wide Text core must keep a radius based on its height instead of reverting '
      + 'to the elliptical 50% rule',
    patches: [{
      file: 'src/styles.ts',
      find: '      border-radius: calc(var(--dev-size, var(--icon-size, 2.5cqw)) / 2);',
      replace: '      border-radius: 50%;',
    }],
  },
  {
    id: 'device-press-duration-drifted',
    guard: 'node --test --test-name-pattern="issue 212 feedback" '
      + 'test/device-marker-polish-contract.test.mjs',
    because: 'accepted device actions must retain the owner-specified bounded 200 ms feedback '
      + 'instead of silently drifting with unrelated animation timings',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '      duration: 200,',
      replace: '      duration: 350,',
    }],
  },
  {
    id: 'device-touch-hover-gate-removed',
    guard: 'node --test --test-name-pattern="issue 212 removes the global touch latch" '
      + 'test/device-marker-polish-contract.test.mjs',
    because: 'touch must not leave a browser-matched device hover painted after the JS tooltip '
      + 'has already been cleared',
    patches: [{
      file: 'src/styles.ts',
      find: '    :host([data-pointer-hover]) .dev:not(.unavail):hover {',
      replace: '    .dev:not(.unavail):hover {',
    }],
  },
  {
    id: 'hatch-step-ignores-cell-cm',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 230" test/wall-thickness.test.mjs',
    because: 'шаг-константа — это и есть баг #230: одна и та же стена 15 см '
      + 'получала от 0.3 до 7.8 полос в зависимости от масштаба сетки',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '  const step = HATCH_BASE_STEP_UNITS * (HATCH_REFERENCE_CELL_CM / c);',
      replace: '  const step = HATCH_BASE_STEP_UNITS;',
    }],
  },
  {
    id: 'hatch-step-inverted',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 230" test/wall-thickness.test.mjs',
    because: 'множитель cell/5 вместо 5/cell — ошибка из описания issue; она не '
      + 'убирает разброс, а увеличивает его',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '  const step = HATCH_BASE_STEP_UNITS * (HATCH_REFERENCE_CELL_CM / c);',
      replace: '  const step = HATCH_BASE_STEP_UNITS * (c / HATCH_REFERENCE_CELL_CM);',
    }],
  },
  {
    id: 'hatch-step-unclamped',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 230" test/wall-thickness.test.mjs',
    because: 'без клампа патологический cell_cm рождает паттерн, который либо '
      + 'сливается в заливку, либо не попадает в стену ни одной полосой',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '  return Math.min(HATCH_MAX_STEP_UNITS, Math.max(HATCH_MIN_STEP_UNITS, step));',
      replace: '  return step;',
    }],
  },
  {
    id: 'hatch-density-solid-threshold-off',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 230" test/wall-thickness.test.mjs',
    because: 'порог по шагу на экране — единственная защита от каши на дальнем '
      + 'конце зума после того, как компенсация 1/zoom убрана',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '    && stepUnits * pxPerUnit < HATCH_MIN_STEP_PX;',
      replace: '    && false;',
    }],
  },
  {
    id: 'hatch-stroke-not-scaled',
    guard: 'node demo/smoke_wall_hatch_density.mjs',
    because: 'штрих обязан следовать за шагом: иначе на мелкой клетке полосы '
      + 'слипаются в сплошное пятно, а на крупной становятся волосяными',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    const stripe = 2 * (step / HATCH_BASE_STEP_UNITS);',
      replace: '    const stripe = 2;',
    }],
  },
  {
    id: 'hatch-zoom-compensation-back',
    guard: 'node demo/smoke_wall_hatch_density.mjs',
    because: 'компенсация 1/zoom возвращает ровно то, ради устранения чего '
      + 'задача и делалась: стена меняет вид при зуме (решение владельца §4.2)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '        width="${step}" height="${step}" patternTransform="rotate(45)">',
      replace: '        width="${step}" height="${step}"\n'
        + '        patternTransform="rotate(45) scale(${Math.max(0.4, 1 / Math.max(this._zoom, 0.4)).toFixed(3)})">',
    }],
  },
  {
    id: 'hatch-static-renderer-untouched',
    guard: 'node demo/smoke_wall_hatch_density.mjs',
    because: 'статический рендерер — второй путь, рисующий тело стены; все '
      + 'golden-сцены снимаются при cell_cm 5, где его константа неотличима',
    patches: [{
      file: 'src/space-render.ts',
      find: '  const hatchStep = wallHatchStepUnits(cellCm);',
      replace: '  const hatchStep = 8;',
    }],
  },
  {
    id: 'partition-merge-rescales-rooms',
    guard: 'node --test --test-name-pattern="issue 229" test/wall-merge.test.mjs',
    because: 'комнаты хранятся в тех же координатах, что перегородки: лишнее деление '
      + 'уносит их в угол и примыкание к стене комнаты перестаёт находиться '
      + '(CODE-REVIEW-229-r1, High-1)',
    patches: [{
      file: 'src/wall-merge.ts',
      find: `      .filter((poly: number[][] | null): poly is number[][] => !!poly),`,
      replace: `      .filter((poly: number[][] | null): poly is number[][] => !!poly)
      .map((poly: number[][]) => poly.map((p) => [p[0] / 1000, p[1] / 1000])),`,
    }],
  },
  {
    id: 'chain-merge-sees-own-draft',
    guard: 'node --test --test-name-pattern="issue 229" test/wall-merge.test.mjs',
    because: 'завершаемая цепочка ещё лежит в room_drafts, и её собственные концы '
      + 'нельзя принимать за чужое примыкание — иначе стык с существующей стеной '
      + 'никогда не срастается (CODE-REVIEW-229-r1, High-2)',
    patches: [{
      file: 'src/wall-merge.ts',
      find: '      if (exclude && draft?.id === exclude) return [];',
      replace: '      void exclude;',
    }],
  },
  {
    id: 'partition-merge-disabled',
    guard: 'node demo/smoke_wall_chain_merge.mjs',
    because: 'без вызова слияния прямая, нарисованная в несколько кликов, снова хранится '
      + 'набором отрезков со швами на каждом стыке (#229)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    this._mergeSpacePartitions(sp, drawnIds);',
      replace: '    void drawnIds;',
    }],
  },
  {
    id: 'partition-merge-ignores-thickness',
    guard: 'node --test --test-name-pattern="issue 229" test/wall-merge.test.mjs',
    because: 'сращивание отрезков разной толщины стирает намеренный переход толщины стены',
    patches: [{
      file: 'src/wall-merge.ts',
      find: '  if (p.cm !== q.cm) return null;',
      replace: '  if (false) return null;',
    }],
  },
  {
    id: 'partition-merge-ignores-junction',
    guard: 'node --test --test-name-pattern="issue 229" test/wall-merge.test.mjs',
    because: 'слияние сквозь примыкание убирает узел, который держит третья стена, '
      + 'комната, колонна или черновик — §8.2 ТЗ',
    patches: [{
      file: 'src/wall-merge.ts',
      find: '        if (junctionAt(at, list, new Set([list[i].id, list[j].id]), options.geometry, join)) continue;',
      replace: '        if (false) continue;',
    }],
  },
  {
    id: 'junction-checks-room-vertices-only',
    guard: 'node --test --test-name-pattern="issue 229" test/wall-merge.test.mjs',
    because: 'поиск примыкания комнаты только по вершинам пропускает T-стык к середине '
      + 'комнатной стены — штатный случай продукта (docs/specs/141-wall-junctions.md)',
    patches: [{
      file: 'src/wall-merge.ts',
      find: '      if (finite(a) && finite(b) && distToSegment(point, a, b) <= join) return true;',
      replace: '      if (finite(a) && dist(point, a) <= join) return true; void b;',
    }],
  },
  {
    id: 'partition-merge-keeps-relative-t',
    guard: 'node --test --test-name-pattern="issue 229" test/wall-merge.test.mjs',
    because: 'сохранение прежней доли вместо пересчёта двигает дверь вдоль стены: '
      + 'позиция проёма относительна длине хозяина, а она при слиянии меняется',
    patches: [{
      file: 'src/wall-merge.ts',
      find: '  const mapped = move.base + t * move.span;',
      replace: '  const mapped = t;',
    }],
  },
  {
    id: 'partition-merge-skips-materialization',
    guard: 'node --test --test-name-pattern="issue 229" test/wall-merge.test.mjs',
    because: 'устаревшие x/y/angle — это то, что рисует старый читатель конфига; '
      + 'слияние канонизирует направление стены, поэтому проекция обязана '
      + 'переписаться (docs/CONFIG-COMPATIBILITY.md, #132)',
    patches: [{
      file: 'src/wall-merge.ts',
      find: `    if (resolved) Object.assign(
      opening, materializePartitionOpening(opening, resolved, ctx.coordScale),
    );`,
      replace: '    void resolved;',
    }],
  },
  {
    id: 'chain-merge-sweeps-whole-space',
    guard: 'node --test --test-name-pattern="issue 229" test/wall-merge.test.mjs',
    because: 'слияние всего пространства при рисовании молча правит старые швы в стороне, '
      + 'минуя отчёт и отмену, которые обещаны им в «Оптимизировать планы» (§8.6 ТЗ)',
    patches: [{
      file: 'src/wall-merge.ts',
      find: '        if (seeds && !seeds.has(list[i].id) && !seeds.has(list[j].id)) continue;',
      replace: '        if (false) continue;',
    }],
  },
  {
    id: 'tab-reorder-not-persisted',
    guard: 'node demo/smoke_space_tab_reorder.mjs',
    because: 'перестановка вкладок, оставшаяся только в памяти, выглядит рабочей ровно до '
      + 'перезагрузки страницы — смок обязан требовать запись на сервер',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    cfg.spaces = applySpaceOrder(cfg.spaces || [], order);\n    this._saveConfig();',
      replace: '    cfg.spaces = applySpaceOrder(cfg.spaces || [], order);',
    }],
  },
  {
    id: 'reorder-skips-materialization',
    guard: 'node demo/smoke_space_tab_reorder.mjs',
    because: 'без материализации привязки маркер без space и area уезжает вслед за порядком: '
      + 'его пространство решает firstSpaceId, а тот после перестановки другой (#220 §8.3)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '      const byId = new Map(pinned.map((entry) => [entry.id, entry.space]));',
      replace: '      const byId = new Map();',
    }],
  },
  {
    id: 'materialization-touches-bound-markers',
    guard: 'node --test --test-name-pattern="issue 220" test/space-order.test.mjs',
    because: 'материализация обязана трогать только маркеры, чьё пространство решает порядок; '
      + 'запись space маркеру, закреплённому HA-областью, кладёт в конфиг поле, которое '
      + 'сдвинет его в старое первое пространство в день смены области (ревью r1, H1)',
    patches: [{
      file: 'src/space-order.ts',
      find: '    if (area && areaToSpace[area]) continue;',
      replace: '    if (false) continue;',
    }],
  },
  {
    id: 'tab-drag-survives-release-outside',
    guard: 'node demo/smoke_space_tab_reorder.mjs',
    because: 'мышь, отпущенная мимо панели, обязана завершить жест: иначе перетаскивание '
      + 'зависает с moved:true и съедает следующий клик по вкладке (ревью r1, M1)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: "    window.addEventListener('pointerup', this._tabDragRelease);",
      replace: '    void 0;',
    }],
  },
  {
    id: 'tab-drag-outlives-the-card',
    guard: 'node demo/smoke_space_tab_reorder.mjs',
    because: 'слушатели жеста, пережившие disconnectedCallback, держат инстанс карточки '
      + 'и дают невидимой карточке записать порядок по следующему pointerup на странице '
      + '(ревью r2/r3, F1)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    this._endTabDrag();\n    clearInterval(this._cycleTimer);',
      replace: '    clearInterval(this._cycleTimer);',
    }],
  },
  {
    id: 'tab-reorder-eats-click',
    guard: 'node --test --test-name-pattern="issue 220" test/space-order.test.mjs',
    because: 'нулевой порог превращает обычный клик по вкладке в перетаскивание, и '
      + 'переключение пространств — основное действие панели — перестаёт работать',
    patches: [{
      file: 'src/space-order.ts',
      find: 'export const TAB_DRAG_THRESHOLD_PX = 4;',
      replace: 'export const TAB_DRAG_THRESHOLD_PX = 0;',
    }],
  },
  {
    id: 'tab-reorder-ignores-pointer-type',
    guard: 'node --test --test-name-pattern="issue 220" test/space-order.test.mjs',
    because: 'на тач-устройстве вкладки — это навигация View, где тап обязан оставаться тапом; '
      + 'решение владельца «Touch editor: not exposed» держится именно этой проверкой',
    patches: [{
      file: 'src/space-order.ts',
      find: "  if (ctx.pointerType !== 'mouse') return false;",
      replace: '  if (false) return false;',
    }],
  },
  {
    id: 'internal-path-ignores-query',
    guard: 'node scripts/backend-test-guard.mjs issue_225',
    because: 'разбор url строкой вместо urlsplit возвращает баг #225: кэш-бастер '
      + '?v=… делает имя файла не равным самому себе, ссылка читается как '
      + 'внутренняя-но-неканоническая, и бэкап с вложением снова не импортируется',
    patches: [{
      file: 'custom_components/houseplan/import_export.py',
      find: '    parsed = urlsplit(url)\n    if parsed.scheme or parsed.netloc:\n        return None\n    url = parsed.path',
      replace: '    url = url.split("?", 1)[0]',
    }],
  },
  {
    id: 'internal-path-trusts-foreign-host',
    guard: 'node scripts/backend-test-guard.mjs issue_225',
    because: 'доверие к path при наличии scheme/netloc позволяет '
      + '"https://evil.example/houseplan_files/files/m1/doc.pdf" разрешиться в локальный '
      + 'файл, хотя _looks_internal считает такую ссылку внешней (ревью r1, M1)',
    patches: [{
      file: 'custom_components/houseplan/import_export.py',
      find: '    if parsed.scheme or parsed.netloc:\n        return None',
      replace: '    if False:\n        return None',
    }],
  },
  {
    id: 'internal-path-allows-traversal',
    guard: 'node scripts/backend-test-guard.mjs issue_225',
    because: 'структурные проверки пути — единственное, что режет traversal после '
      + 'отделения query; снимать их нельзя. Мутант снимает обе сразу: по одной '
      + 'защита эшелонирована (sanitize-сравнение ловит "..") и мутант был бы '
      + 'эквивалентным — выяснено прогоном при реализации',
    patches: [{
      file: 'custom_components/houseplan/import_export.py',
      find: '        if not raw_name or "/" in raw_name:\n            return None',
      replace: '        raw_name = raw_name.split("/")[-1]\n        if not raw_name:\n            return None',
    }, {
      file: 'custom_components/houseplan/import_export.py',
      find: '            tail = url[len(prefix):].split("/")\n            if len(tail) != 2:\n                return None',
      replace: '            tail = url[len(prefix):].split("/")[-2:]',
    }],
  },
  {
    id: 'opening-dimensions-use-axis-ends',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="room dimensions stop at inner faces" '
      + 'test/opening-dimensions.test.mjs',
    because: 'a placement ruler must stop at the physical inner face endpoints, not silently '
      + 'return to the room-axis endpoints that #238 replaces',
    patches: [{
      file: 'src/opening-dimensions.ts',
      find: '  const [lo, hi] = run;',
      replace: '  const [lo, hi] = [basis.targetLo, basis.targetHi];',
    }],
  },
  {
    id: 'opening-dimensions-collapse-shared-side',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="shared wall keeps two independently resolved room sides" '
      + 'test/opening-dimensions.test.mjs',
    because: 'a shared wall has two independently inset room faces and must render four '
      + 'measurements; collapsing two owners back to one pair loses real geometry',
    patches: [{
      file: 'src/opening-dimensions.ts',
      find: '  if (owners.length > 2) return fallbackDimensions(basis);',
      replace: '  if (owners.length > 1) return fallbackDimensions(basis);',
    }],
  },
  {
    id: 'opening-dimensions-use-crossing-axis',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="independent T junction measures to the near masonry face" '
      + 'test/opening-dimensions.test.mjs',
    because: 'an independent partition ruler must meet the near physical face of a crossing '
      + 'wall; shrinking the boundary body to its axis recreates the incorrect distance',
    patches: [{
      file: 'src/opening-dimensions.ts',
      find: '      halfDepth,\n    });',
      replace: '      halfDepth: epsilon,\n    });',
    }],
  },
  {
    id: 'opening-dimension-overlay-hidden',
    guard: 'node demo/smoke_opening_inner_distances.mjs',
    because: 'correct numbers alone do not identify which physical span they describe; the '
      + 'placement preview must keep its dimension lines and endpoint ticks visible',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '            ${opMeasure ? this._renderOpeningDimensionGuides(opMeasure) : nothing}',
      replace: '            ${nothing}',
    }],
  },
];

// --- механика ---------------------------------------------------------------
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

export function applyPatches(root, patches) {
  for (const patch of patches) {
    const path = join(root, patch.file);
    const source = readFileSync(path, 'utf8');
    const hits = source.split(patch.find).length - 1;
    if (hits !== 1) {
      throw new Error(`${patch.file}: якорь найден ${hits} раз(а), нужен ровно 1 — реестр отстал от кода`);
    }
    writeFileSync(path, source.replace(patch.find, patch.replace));
  }
}

function sh(cmd, cwd, extraEnv = {}) {
  return spawnSync(cmd, {
    cwd, shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, ...extraEnv },
  });
}

function makeWorktree() {
  const dir = mkdtempSync(join(tmpdir(), 'hp-mutant-'));
  const added = spawnSync('git', ['-C', repoRoot, 'worktree', 'add', '--detach', dir, 'HEAD'],
    { encoding: 'utf8' });
  if (added.status !== 0) throw new Error(`git worktree add: ${added.stderr}`);
  // node_modules не копируется — символическая ссылка на настоящий. Установка
  // зависимостей на каждого мутанта превратила бы вечерний гейт в суточный.
  symlinkSync(join(repoRoot, 'node_modules'), join(dir, 'node_modules'), 'junction');
  return dir;
}

function dropWorktree(dir) {
  spawnSync('git', ['-C', repoRoot, 'worktree', 'remove', '--force', dir], { encoding: 'utf8' });
  rmSync(dir, { recursive: true, force: true });
}

/**
 * Нужен ли гварду скомпилированный `test-build/` (#235).
 *
 * Гварды в реестре двух видов: длинные сами начинаются с
 * `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs`, короткие —
 * сразу с `node --test`. В свежем worktree каталога `test-build/` нет вообще,
 * поэтому короткий гвард падал с `ERR_MODULE_NOT_FOUND` — и это читалось как
 * «мутант поймал поломку», хотя означало «гвард не смог исполниться». Компиляция
 * стоит секунд, поэтому шаг ставится только там, где гвард не делает его сам.
 */
export function guardNeedsTestBuild(guard) {
  return /(^|[\s&|;])node --test\b/.test(guard) && !guard.includes('tsconfig.test.json');
}

/**
 * Собрать `test-build/` из мутированного src в каталоге мутанта.
 *
 * Код выхода `tsc` игнорируется сознательно, по той же причине, что и в
 * `buildBundle`: мутант воспроизводит поломку, а не образцовый код, и имеет
 * право быть нестрогим по типам. Доказательством служит появление каталога —
 * если его нет, падаем громко, а не отдаём тесту пустоту.
 */
function buildTestBuild(dir) {
  sh('npx tsc -p tsconfig.test.json', dir);
  const fixed = sh('node scripts/fix-test-build.mjs', dir);
  if (!existsSync(join(dir, 'test-build'))) {
    throw new Error(`test-build не собрался в мутанте:\n${(fixed.stderr || fixed.stdout).slice(-2000)}`);
  }
}

function buildBundle(dir) {
  // Только rollup, без tsc --noEmit: мутант имеет право быть нестрогим по
  // типам — он воспроизводит поломку, а не образцовый код.
  const built = sh('npx rollup -c', dir);
  if (built.status !== 0) {
    throw new Error(`сборка мутанта упала:\n${(built.stderr || built.stdout).slice(-2000)}`);
  }
  cpSync(join(dir, 'dist', 'houseplan-card.js'), join(dir, 'demo', 'srv', 'assets', 'houseplan-card.js'));
}

function runMutant(mutant) {
  const dir = makeWorktree();
  try {
    applyPatches(dir, mutant.patches);
    buildBundle(dir);
    if (guardNeedsTestBuild(mutant.guard)) buildTestBuild(dir);
    const guard = sh(mutant.guard, dir);
    if (guard.status === 0) {
      console.log(`FAIL ${mutant.id}: тест остался зелёным на сломанном коде`);
      console.log(`     guard: ${mutant.guard}`);
      console.log(`     ${mutant.because}`);
      return false;
    }
    console.log(`ok   ${mutant.id}: тест покраснел, как обязан`);
    return true;
  } finally {
    dropWorktree(dir);
  }
}

// Чистый прогон каждого guard ровно один раз: тест, красный и без мутанта,
// «ловит» поломку тривиально и не доказывает ничего.
function runCleanGuards(mutants) {
  const guards = [...new Set(mutants.map((m) => m.guard))];
  const dir = makeWorktree();
  try {
    buildBundle(dir);
    // Один worktree на все чистые гварды — значит и компиляция одна.
    if (guards.some(guardNeedsTestBuild)) buildTestBuild(dir);
    for (const guard of guards) {
      const result = sh(guard, dir);
      if (result.status !== 0) {
        console.log(`FAIL чистый прогон: ${guard} красный без мутанта`);
        console.log((result.stderr || result.stdout).slice(-1500));
        return false;
      }
      console.log(`ok   чистый прогон: ${guard}`);
    }
    return true;
  } finally {
    dropWorktree(dir);
  }
}

function main(argv) {
  const idArg = argv.find((a) => a.startsWith('--id='))?.slice(5);
  const selected = idArg ? MUTANTS.filter((m) => m.id === idArg) : MUTANTS;
  if (idArg && !selected.length) {
    console.error(`мутант «${idArg}» не объявлен; --list покажет реестр`);
    return 2;
  }

  if (argv.includes('--list')) {
    for (const m of MUTANTS) console.log(`${m.id}\n  guard: ${m.guard}\n  ${m.because}\n`);
    return 0;
  }

  if (argv.includes('--check')) {
    let stale = 0;
    for (const m of selected) {
      try {
        for (const patch of m.patches) {
          const source = readFileSync(join(repoRoot, patch.file), 'utf8');
          const hits = source.split(patch.find).length - 1;
          if (hits !== 1) throw new Error(`якорь найден ${hits} раз(а)`);
        }
        console.log(`ok   ${m.id}`);
      } catch (error) {
        console.log(`FAIL ${m.id}: ${error.message}`);
        stale++;
      }
    }
    return stale ? 2 : 0;
  }

  if (argv.includes('--build-only')) {
    for (const m of selected) {
      const dir = makeWorktree();
      try {
        applyPatches(dir, m.patches);
        buildBundle(dir);
        console.log(`ok   ${m.id}: патч лёг, бандл собрался`);
      } catch (error) {
        console.log(`FAIL ${m.id}: ${error.message}`);
        return 2;
      } finally {
        dropWorktree(dir);
      }
    }
    return 0;
  }

  if (!runCleanGuards(selected)) return 2;
  let caught = 0;
  for (const m of selected) if (runMutant(m)) caught++;
  console.log(`\nпоймано ${caught} из ${selected.length}`);
  return caught === selected.length ? 0 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main(process.argv.slice(2)));
}
