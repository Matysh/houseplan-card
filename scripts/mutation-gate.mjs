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
    id: 'wallthick-hover-floor-back',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="uses the exact physical wall width" '
      + 'test/grid-scale.test.mjs',
    because: 'restoring the raw grid-unit floor inflates a 50 cm hover strip to 75 cm '
      + 'on a 30 cm cell instead of matching the physical wall body from #303',
    patches: [{
      file: 'src/grid-scale.ts',
      find: '    ? wallCmToUnits(thicknessCm, normalizedCellCm, normalizedPitch) / 2\n',
      replace: '    ? Math.max(\n'
        + '      wallCmToUnits(thicknessCm, normalizedCellCm, normalizedPitch) / 2,\n'
        + '      normalizedPitch * 1.25,\n'
        + '    )\n',
    }],
  },
  {
    id: 'wallthick-zero-strip-not-visual',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="zero-thickness hover" '
      + 'test/grid-scale.test.mjs',
    because: 'the visible strip for a zero-thickness wall must have one physical size across '
      + 'cell scales rather than growing with the coordinate grid',
    patches: [{
      file: 'src/grid-scale.ts',
      find: '    : gridVisualUnits(normalizedPitch * 1.5, normalizedCellCm);',
      replace: '    : normalizedPitch * 1.5;',
    }],
  },
  {
    id: 'wallthick-hit-narrowed',
    guard: 'node demo/smoke_wallthick_hover_width.mjs',
    because: 'the visual correction must not make the Thickness tool harder to hit with a '
      + 'pointer or finger; its six-pitch hit radius is a separate UX contract',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    const space = this._spaceModel();\n'
        + '    if (!space) return null;\n'
        + '    const pull = this._gridPitch * 6;\n'
        + '    const cuts = this._openCuts();',
      replace: '    const space = this._spaceModel();\n'
        + '    if (!space) return null;\n'
        + '    const pull = this._gridPitch * 2;\n'
        + '    const cuts = this._openCuts();',
    }],
  },
  {
    id: 'opening-search-filter-dead',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="matches friendly name" '
      + 'test/opening-entity-search.test.mjs',
    because: 'the opening picker must actually apply the typed query; returning the unfiltered '
      + 'candidate list recreates the original hundred-row scrolling problem from #301',
    patches: [{
      file: 'src/logic.ts',
      find: '  const normalized = query.trim().toLowerCase();',
      replace: "  const normalized = '';",
    }],
  },
  {
    id: 'opening-search-name-only',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="matches entity id" '
      + 'test/opening-entity-search.test.mjs',
    because: 'large HA installations often identify the wanted opening by entity_id rather '
      + 'than a duplicated friendly name, so a label-only search violates #301 directly',
    patches: [{
      file: 'src/logic.ts',
      find: '      candidate.label.toLowerCase().includes(normalized)\n'
        + '        || candidate.value.toLowerCase().includes(normalized))',
      replace: '      candidate.label.toLowerCase().includes(normalized))',
    }],
  },
  {
    id: 'opening-search-order-resorted',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="preserves resolver order" '
      + 'test/opening-entity-search.test.mjs',
    because: 're-sorting a filtered contact list hides door/window device classes behind '
      + 'generic binary sensors and discards the deliberate resolver priority from #301',
    patches: [{
      file: 'src/logic.ts',
      find: '  return filtered.slice(0, Math.max(0, limit));',
      replace: '  return [...filtered].sort((a, b) => a.label.localeCompare(b.label))'
        + '.slice(0, Math.max(0, limit));',
    }],
  },
  {
    id: 'opening-search-hides-none',
    guard: 'node demo/smoke_opening_entity_search.mjs',
    because: 'the clear-binding action must remain first and visible for every query, including '
      + 'a query with no matches; hiding it can trap a stale contact or lock on the opening',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '                <button type="button" class="cand opening-entity-candidate ${cur ? \'\' : \'sel\'}"\n'
        + '                  data-opening-entity="" @click=${() => this._selectOpeningEntity(kind, \'\')}>\n'
        + '                  <span class="cl">${this._t(\'opening.none\')}</span>\n'
        + '                </button>\n',
      replace: '',
    }],
  },
  {
    id: 'opening-search-select-not-wired',
    guard: 'node demo/smoke_opening_entity_search.mjs',
    because: 'a visually filtered result is useless unless its click writes the exact entity_id '
      + 'into opening.contact or opening.lock and closes the picker as required by #301',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '                    @click=${() => this._selectOpeningEntity(kind, candidate.value)}>',
      replace: '                    @click=${() => this._selectOpeningEntity(kind, \'\')}>',
    }],
  },
  {
    id: 'device-tombstone-blocks-child-picker',
    guard: 'node demo/smoke_binding_picker.mjs',
    because: 'a device tombstone must expose an active child in Add when Show entities is on; '
      + 'restoring only the exact device reproduces the user-visible dead end from #262',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '        if (isRemovedPlanEntity(h, eid, removed)\n'
        + '            && !removedBindings.has(v) && !childOfRemovedDevice) continue;',
      replace: '        if (isRemovedPlanEntity(h, eid, removed)\n'
        + '            && !removedBindings.has(v)) continue;',
    }],
  },
  {
    id: 'live-child-still-suppressed-by-parent-tombstone',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 262" test/devices.test.mjs',
    because: 'fixing only the picker lets the person select X but buildDevices and every '
      + 'availability consumer still discard it after Save; a live exact child must win (#262)',
    patches: [{
      file: 'src/devices.ts',
      find: '  if (removed.liveEntities.has(eid)) return false;\n',
      replace: '',
    }],
  },
  {
    id: 'parent-tombstone-restores-all-siblings',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 262" test/devices.test.mjs',
    because: 'one restored child is an exact override, not permission for every sibling and '
      + 'room aggregate of the deleted parent device to return (#262)',
    patches: [{
      file: 'src/devices.ts',
      find: '  if (removed.liveEntities.has(eid)) return false;\n',
      replace: '  if (removed.liveEntities.size) return false;\n',
    }],
  },
  {
    id: 'child-readd-clears-parent-tombstone',
    guard: 'node demo/smoke_binding_picker.mjs',
    because: 'saving one child must preserve the device tombstone; dropping all tombstones '
      + 'resurrects the automatic parent and the siblings the person deliberately removed (#262)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: `      cfg.markers = cfg.markers.filter(
        (m) => m.id !== id && m.id !== oldId
          && (marker.binding === 'virtual' || m.binding !== marker.binding),
      );`,
      replace: `      cfg.markers = cfg.markers.filter(
        (m) => m.id !== id && m.id !== oldId
          && (marker.binding === 'virtual' || m.binding !== marker.binding)
          && (!marker.binding.startsWith('entity:') || m.removed !== true),
      );`,
    }],
  },
  {
    id: 'orphan-space-detach-disabled',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="detaches a live marker" '
      + 'test/space-reference-repair.test.mjs',
    because: 'an active marker with no exact copy or usable Area must lose only its dead space '
      + 'field; retaining that one field is the original invisibility bug and must be caught '
      + 'without relying on rendering (#244)',
    patches: [{
      file: 'src/space-reference-repair.ts',
      find: '        } else {\n          delete marker.space;\n          targetSpace = null;\n'
        + '          report.markersDetached++;\n        }',
      replace: '        } else {\n          targetSpace = null;\n'
        + '          report.markersDetached++;\n        }',
    }],
  },
  {
    id: 'orphan-space-ambiguous-signature-guessed',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="ambiguous, truncated and malformed" '
      + 'test/space-reference-repair.test.mjs',
    because: 'choosing the first of two independent import copies moves a device between plans '
      + 'by array order; exact signature repair is safe only when the candidate is unique (#244)',
    patches: [{
      file: 'src/space-reference-repair.ts',
      find: '        const candidates = spaceSignatures.get(root) || [];\n'
        + '        return candidates.length === 1 ? candidates[0] : null;',
      replace: '        const candidates = spaceSignatures.get(root) || [];\n'
        + '        return candidates[0] || null;',
    }],
  },
  {
    id: 'orphan-cleanup-partial-registry-deletes',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="fails closed for limited registry" '
      + 'test/space-reference-repair.test.mjs',
    because: 'limited registry access is not proof that an HA device or group was deleted; '
      + 'treating it as authoritative destroys positions on permission/network failures (#252)',
    patches: [{
      file: 'src/space-reference-repair.ts',
      find: '  const rosterAuthoritative = roster?.authoritative === true;',
      replace: '  const rosterAuthoritative = true;',
    }],
  },
  {
    id: 'orphan-cleanup-proven-owners-kept',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="removes only proven room, device and group" '
      + 'test/space-reference-repair.test.mjs',
    because: 'proof without deletion leaves the exact maintenance debt #252 exists to remove; '
      + 'all three supported owner categories must change the candidate once and only once',
    patches: [{
      file: 'src/space-reference-repair.ts',
      find: "    if (status === 'absent') {\n      delete layout[key];\n      countRemoval(owner.kind);",
      replace: "    if (status === 'absent') {\n      countRemoval(owner.kind);",
    }],
  },
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
      find: '    const inherited = previous ?? active ?? fallback;',
      replace: '    const inherited = active ?? fallback;',
    }],
  },
  {
    id: 'chain-thickness-live-tail-inherits-previous',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="live rubber-band" '
      + 'test/wall-face-graph.test.mjs',
    because: 'the last missing thickness belongs to the live rubber-band, so a field change '
      + 'between clicks must preview the value that the click will commit instead of inheriting '
      + 'the preceding segment (#234)',
    patches: [{
      file: 'src/wall-face-graph.ts',
      find: '    const liveTail = active ?? previous ?? fallback;',
      replace: '    const liveTail = previous ?? active ?? fallback;',
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
    id: 'safe-resize-axis-eligibility-bypassed',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="diagonal and non-perpendicular" test/resize.test.mjs',
    because: 'an angled wall must never enter the production resize plan; accepting it restores '
      + 'the topology-changing path that #277 removes',
    patches: [{
      file: 'src/resize.ts',
      find: '  const movingAxis = axisOf(a, b, eps);',
      replace: "  const movingAxis = axisOf(a, b, eps) || 'h';",
    }, {
      file: 'src/resize.ts',
      find: "  if (!movingAxis) return { enabled: false, reason: 'diagonal' };",
      replace: "  if (false && !movingAxis) return { enabled: false, reason: 'diagonal' };",
    }],
  },
  {
    id: 'safe-resize-wall-endpoints-affine-scaled',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 298" test/wall-thickness.test.mjs',
    because: 'fixed-topology Resize may translate a moving wall or move its topology endpoint, '
      + 'but proportional scaling invents a wall-record coordinate with no carrier (#298)',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: "    if (mode === 'fixed-topology') {\n"
        + '      const adx = move.na[0] - move.oa[0], ady = move.na[1] - move.oa[1];',
      replace: "    if (false && mode === 'fixed-topology') {\n"
        + '      const adx = move.na[0] - move.oa[0], ady = move.na[1] - move.oa[1];',
    }],
  },
  {
    id: 'safe-resize-legacy-midpoint-fail-open',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 298 fixed-topology legacy" '
      + 'test/wall-thickness.test.mjs',
    because: 'Safe Resize must reject an affected key-only midpoint unless it names '
      + 'one unambiguous whole changed edge (#298)',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: "    if (mode === 'fixed-topology') {\n      const direct = wholeEdgeMoves.get(w.key);",
      replace: "    if (false && mode === 'fixed-topology') {\n      const direct = wholeEdgeMoves.get(w.key);",
    }],
  },
  {
    id: 'safe-resize-third-room-cascade-enabled',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="partial shared and third-owner" test/resize.test.mjs',
    because: 'a long edge split between neighbours may not turn into a three-room cascade or '
      + 'insert vertices; the anonymized #277 regression pins that exact topology',
    patches: [{
      file: 'src/resize.ts',
      find: "  if (partial) return { enabled: false, reason: 'partial-shared' };",
      replace: "  if (false && partial) return { enabled: false, reason: 'partial-shared' };",
    }],
  },
  {
    id: 'safe-resize-topology-signature-bypassed',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="exactly two existing vertices" test/resize.test.mjs',
    because: 'preview and commit must reject a candidate whose vertex count no longer matches '
      + 'the gesture plan; otherwise simplify/insert can silently return through another path',
    patches: [{
      file: 'src/resize.ts',
      find: '    if (!original || !next || next.length !== plan.topology[roomId]\n'
        + '        || next.length !== original.poly.length || !polyIsSimple(next)) return false;',
      replace: '    if (!original || !next || !polyIsSimple(next)) return false;',
    }],
  },
  {
    id: 'safe-resize-side-ownership-bypassed',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="#289 side ownership" test/resize.test.mjs',
    because: 'extending or shortening a shared side wall must stop before one thickness record '
      + 'describes both shared and outer material; the exact 43-step #289 fixture pins both directions',
    patches: [{
      file: 'src/resize.ts',
      find: '  if (!sideOwnershipPreserved(result, plan, eps)) return false;',
      replace: '  if (false && !sideOwnershipPreserved(result, plan, eps)) return false;',
    }],
  },
  {
    id: 'safe-resize-opening-jamb-bypassed',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="physical jamb" test/resize.test.mjs',
    because: 'the moving wall body must stop before a perpendicular opening, including half its '
      + 'physical thickness; centreline-only fitting overlaps the jamb',
    patches: [{
      file: 'src/resize.ts',
      find: '    >= opening.length / 2 + movingHalf - eps;',
      replace: '    >= -Infinity;',
    }],
  },
  {
    id: 'safe-resize-commit-preflight-bypassed',
    guard: 'node demo/smoke_room_resize.mjs',
    because: 'a candidate rejected by the exact production wall/floor preflight must create '
      + 'neither preview nor commit; polygon-only success previously persisted disappearing walls',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    const candidateValid = this._rszCandidateRenderable(preview);',
      replace: '    const candidateValid = !!preview;',
    }, {
      file: 'src/houseplan-card.ts',
      find: '      safe = this._checkSpacePhysicalGeometry(this._serverCfg, before.spaceId).ok;',
      replace: '      safe = true;',
    }],
  },
  {
    id: 'resize-history-boundary-repair-removed',
    guard: 'node demo/smoke_resize_pointer_real_plan.mjs',
    because: 'write-time wall degradation must not erase the one Resize Undo command; '
      + 'the strict outbound barrier remains authoritative after the local restore (#293)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: "          && check?.reason === 'wall-degraded-extra');",
      replace: '          && false);',
    }],
  },
  {
    id: 'resize-audit-resolver-bypassed',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test test/resize-availability-audit.test.mjs',
    because: 'the real-plan availability counter must classify every handle through the same '
      + 'resolver as production render; an always-enabled audit would make the baseline meaningless (#292)',
    patches: [{
      file: 'src/resize.ts',
      find: '      const resolution = resolveSafeResize(\n'
        + '        rooms, openings, room.id, edge, optionsFor(room.id, edge, a, b),\n'
        + '      );',
      replace: '      const resolution: SafeResizeResolution = { enabled: true, plan: {} as SafeResizePlan };',
    }],
  },
  {
    id: 'resize-pointer-delta-zeroed',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="#293 pointer displacement" test/resize.test.mjs',
    because: 'an enabled handle must turn real pointer travel into a signed wall displacement; '
      + 'returning zero recreates the active-but-inert user report from #293',
    patches: [{
      file: 'src/resize.ts',
      find: '  return (current[0] - start[0]) * normal[0]',
      replace: '  return (current[0] - start[0]) * 0',
    }],
  },
  {
    id: 'resize-shared-seam-not-coalesced',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="moving a shared seam" test/wall-thickness.test.mjs',
    because: 'two owners moving one internal seam must keep the continuous side wall as one '
      + 'record; atomising it changes metadata cardinality and silently rejects every preview (#293)',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '        if (previous && closePoint(previous[1], atom[0])\n'
        + '            && collinearForward(previous, atom)) {',
      replace: '        if (false && previous && closePoint(previous[1], atom[0])\n'
        + '            && collinearForward(previous, atom)) {',
    }],
  },
  {
    id: 'resize-pointer-capture-removed',
    guard: 'node demo/smoke_resize_pointer_real_plan.mjs',
    because: 'the real pointer must keep driving the gesture after it leaves the small SVG handle; '
      + 'without capture the visible preview freezes as soon as the cursor exits (#293)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    capturePointer(ev);\n    const plan = resolution.plan;',
      replace: '    // mutant: pointer capture removed\n    const plan = resolution.plan;',
    }],
  },
  {
    id: 'resize-preview-reject-silent',
    guard: 'node demo/smoke_room_resize.mjs',
    because: 'an unexpected runtime preflight rejection must explain why an enabled handle '
      + 'stopped instead of restoring the original silent no-op (#293)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: "        this._showToast(this._t('resize.preview_failed'));",
      replace: '        // mutant: reject remains silent',
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
    id: 'resize-labels-drops-measured-edge',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test test/resize-labels.test.mjs',
    because: 'each of the two remaining length badges must retain a matching side-wall '
      + 'highlight; duplicating one edge silently drops the other measurement (#300)',
    patches: [{
      file: 'src/resize-labels.ts',
      find: '  return [(movingEdge - 1 + n) % n, (movingEdge + 1) % n];',
      replace: '  return [(movingEdge - 1 + n) % n, (movingEdge - 1 + n) % n];',
    }],
  },
  {
    id: 'resize-labels-same-side-areas',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test test/resize-labels.test.mjs',
    because: 'the inward side must follow polygon winding; a shared wall needs its two room '
      + 'areas on opposite sides instead of stacked together (#300)',
    patches: [{
      file: 'src/resize-labels.ts',
      find: '  return signedArea(poly) >= 0\n',
      replace: '  return true\n',
    }],
  },
  {
    id: 'resize-labels-ignore-gear-collision',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test test/resize-labels.test.mjs',
    because: 'a visible room-settings button must move the area badge tangentially at current '
      + 'zoom; keeping the nominal position recreates the overlap (#300)',
    patches: [{
      file: 'src/resize-labels.ts',
      find: '  if (collides(0)) {',
      replace: '  if (false && collides(0)) {',
    }],
  },
  {
    id: 'resize-labels-hide-narrow-area',
    guard: 'node demo/smoke_resize_labels.mjs',
    because: 'the owner chose always-visible area labels; keeping only one owner in a narrow '
      + 'shared fixture loses the second room instead of using its leader (#300)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    for (const id of ids) {\n      const poly = res.polys[id]',
      replace: '    for (const id of ids.slice(0, 1)) {\n      const poly = res.polys[id]',
    }],
  },
  {
    id: 'resize-wall-partial-overlap-not-split',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 253 splits a longer exact wall" '
      + 'test/wall-thickness.test.mjs',
    because: 'a room edge may cover only part of a longer thickness record; omitting the overlap '
      + 'boundaries recreates #253 by leaving the entire record behind instead of moving one atom',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '      const bounds = [0, 1, ...overlaps.flatMap(({ lo, hi }) => [lo, hi])]',
      replace: '      const bounds = [0, 1]',
    }],
  },
  {
    id: 'resize-wall-key-collision-drops-record',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="key collisions never erase" '
      + 'test/wall-thickness.test.mjs',
    because: 'compatibility keys identify a quantised midpoint, not an exact interval; treating '
      + 'them as unique silently deletes different thickness records, the second half of #253',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '    const duplicate = exactOut.some((candidate) => candidate.entry.cm === value\n'
        + '      && closePoint(candidate.span[0], ca) && closePoint(candidate.span[1], cb));',
      replace: '    const duplicate = exactOut.some((candidate) =>\n'
        + '      candidate.entry.key === keyOf(ca, cb, pitch, scale));',
    }],
  },
  {
    id: 'wall-key-storage-normalization-disabled',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 258 wallKey" '
      + 'test/wall-thickness.test.mjs',
    because: 'one grid endpoint has exact and nine-decimal storage forms; keying their midpoint '
      + 'without first stabilising the endpoints recreates the one-grid-step key fork from #258',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '  return Math.abs(snapped - v) <= keyEpsilon(pitch) ? snapped : v;',
      replace: '  return v;',
    }],
  },
  {
    id: 'multi-wall-orthogonal-strip-protection-disabled',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue #275 preserves" '
      + 'test/wall-thickness.test.mjs',
    because: 'pairwise bevel cuts must exclude every finite strip with an orthogonal partner, '
      + 'and the post-cut reconstruction is the independent fail-safe; disabling both recreates '
      + 'the white notches and large missing wall areas from the exact #275 fixtures',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '  return cuts && protectedStrips ? difference(cuts, protectedStrips) : cuts;',
      replace: '  return cuts;',
    }, {
      file: 'src/wall-thickness.ts',
      find: '      if (protectedStrips) local = union(local, protectedStrips);',
      replace: '      // protected-strip fail-safe intentionally disabled by the mutant',
    }, {
      file: 'src/wall-thickness.ts',
      find: '  if (protectedStrips) {\n'
        + '    try {\n'
        + '      let protectedInside = protectedStrips;',
      replace: '  if (protectedStrips && false) {\n'
        + '    try {\n'
        + '      let protectedInside = protectedStrips;',
    }],
  },
  {
    id: 'multi-wall-finite-ray-disabled',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue #271 keeps finite" '
      + 'test/wall-thickness.test.mjs',
    because: 'a degree-3 repair must stop at every real interval endpoint; restoring the '
      + 'node-wide 8H rectangle recreates the phantom wall and light barrier from #271',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '      const supportExtent = Math.min(extent, support.length);',
      replace: '      const supportExtent = extent;',
    }],
  },
  {
    id: 'multi-wall-shared-continuation-protection-disabled',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue #288 keeps" '
      + 'test/wall-thickness.test.mjs',
    because: 'a node-wide replacement mask must retain the finite shared wall attached to the '
      + 'far endpoint of a short ray; dropping that ownership recreates the four 45-step gaps '
      + 'from the real second-floor fixture (#288)',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: "          if (candidate.kind !== 'shared'\n",
      replace: "          if (candidate.kind === 'shared'\n",
    }],
  },
  {
    id: 'multi-wall-exterior-corridor-disabled',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue #249 bounds" '
      + 'test/wall-thickness.test.mjs',
    because: 'ending every excessive bevel cut at one mathematical point recreates the enclosed '
      + 'white junction triangles from #272 while the old retained/discarded probes still pass',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '    multiWallBevelCutsAt(nodeMap, retainToLimit, connectToExterior),',
      replace: '    multiWallBevelCutsAt(nodeMap, retainToLimit, false),',
    }],
  },
  {
    id: 'wall-exact-span-fallback-disabled',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 258 exact-span" '
      + 'test/wall-thickness.test.mjs',
    because: 'already affected plans must resolve the same physical a/b span immediately even '
      + 'when their persisted midpoint key is on the other side of the rounding tie (#258)',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '  const exactEps = keyEpsilon(pitch) * scale;',
      replace: '  const exactEps = -1;',
    }],
  },
  {
    id: 'invariant-wall-key-storage-normalization-disabled',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="копия wallKey" '
      + 'test/model-invariants.test.mjs',
    because: 'the raw-model invariant keeps a deliberate copy of production wallKey; if its '
      + 'storage-noise normalisation drifts, the diagnostic and runtime disagree again (#258)',
    patches: [{
      file: 'scripts/model-invariants.mjs',
      find: '  return Math.abs(snapped - value) <= keyEpsilon(pitch) ? snapped : value;',
      replace: '  return value;',
    }],
  },
  {
    id: 'unit-formatting-escapes-the-formatter',
    guard: 'node --test --test-name-pattern="детектор действительно ловит" '
      + 'test/single-source-numbers.test.mjs',
    because: 'одно число, видимое дважды, обязано иметь один источник: расхождение превью и '
      + 'записи стоило продукту #234, а расхождение подписи и площади — #233. Детектор без '
      + 'способности сработать — это разрешение собирать подписи где угодно',
    patches: [{
      file: 'test/single-source-numbers.test.mjs',
      find: "  + '\\\\s*(m²|ft²|м²|m\\\\b|cm\\\\b|см(?![а-яё])|м(?![а-яё])|′|″)',",
      replace: "  + '\\\\s*(ЗАГЛУШКА)',",
    }],
  },
  {
    id: 'invariant-loses-wall-record',
    guard: 'node --test --test-name-pattern="исчезнувшая запись толщины" '
      + 'test/model-invariants.test.mjs',
    because: 'потеря записи толщины — это дефект #253, найденный человеком глазами; если '
      + 'инвариант перестанет её замечать, класс вернётся в продукт незамеченным (#254)',
    patches: [{
      file: 'scripts/model-invariants.mjs',
      find: '    if (now === 0) {',
      replace: '    if (false) {',
    }],
  },
  {
    id: 'invariant-hidden-counts-corner-touch',
    guard: 'node --test --test-name-pattern="касание углом" test/model-invariants.test.mjs',
    because: 'перегородка, продолжающая стену за угол, законна: общего с ребром у неё ровно '
      + 'точка. Порог в шаг решётки — единственное, что отделяет находку от ложного '
      + 'срабатывания на каждом углу плана (#296)',
    patches: [{
      file: 'scripts/model-invariants.mjs',
      find: '        if (overlap > GRID_STEP_N && (!best || overlap > best.overlap)) {',
      replace: '        if (overlap >= 0 && (!best || overlap > best.overlap)) {',
    }],
  },
  {
    id: 'invariant-hidden-tolerates-two-point-draft',
    guard: 'node --test --test-name-pattern="черновик из двух точек" '
      + 'test/model-invariants.test.mjs',
    because: 'ровно это условие пропускает вырожденный черновик в align-grid: `points.length '
      + '>= 2` считает контур из двух точек годным, а комнатой он не станет никогда — '
      + 'и остаётся невидимым препятствием для ресайза (#296)',
    patches: [{
      file: 'scripts/model-invariants.mjs',
      find: '      if (points.length < 3) {',
      replace: '      if (points.length < 2) {',
    }],
  },
  {
    id: 'invariant-hidden-ignores-collinearity',
    guard: 'node --test --test-name-pattern="перегородка поперёк комнаты" '
      + 'test/model-invariants.test.mjs',
    because: 'перегородка поперёк комнаты — единственный смысл существования перегородки; '
      + 'без проверки поперечного отклонения проверка ловит её и будет отключена в первую '
      + 'неделю (#296)',
    patches: [{
      file: 'scripts/model-invariants.mjs',
      find: '  if (across(c) > EDGE_TOLERANCE || across(d) > EDGE_TOLERANCE) return 0;',
      replace: '  if (false) return 0;',
    }],
  },
  {
    id: 'invariant-roles-sample-endpoints',
    guard: 'node --test --test-name-pattern="реальные планы проекта эту проверку" '
      + 'test/model-invariants.test.mjs',
    because: 'конец записи — узел, а не участок: там стена законно касается двух комнат, '
      + 'и включение концов в выборку даёт ложное срабатывание на каждой наружной стене, '
      + 'упирающейся в общую (#287)',
    patches: [{
      file: 'scripts/model-invariants.mjs',
      find: '  for (let i = 1; i < samples; i++) {',
      replace: '  for (let i = 0; i <= samples; i++) {',
    }],
  },
  {
    id: 'invariant-keys-cry-wolf',
    guard: 'node --test --test-name-pattern="старый и неразбираемый compatibility key" '
      + 'test/model-invariants.test.mjs',
    because: 'valid exact endpoints prove the same physical span before every legacy key '
      + 'fallback; calling a stale or unparsable index a violation would cry wolf (#258)',
    patches: [{
      file: 'scripts/model-invariants.mjs',
      find: "      notes.push({ invariant: 'wall_keys', kind: 'stale_wall_key', owner,",
      replace: "      violations.push({ invariant: 'wall_keys', kind: 'stale_wall_key', owner,",
    }],
  },
  {
    id: 'invariant-keys-hide-stale-observation',
    guard: 'node --test --test-name-pattern="старый и неразбираемый compatibility key" '
      + 'test/model-invariants.test.mjs',
    because: 'a mismatched compatibility key is repairable data debt; hiding the observation '
      + 'would make Optimize repair invisible and let the two representations accumulate (#258)',
    patches: [{
      file: 'scripts/model-invariants.mjs',
      find: '      if (wall.key === expected) continue;',
      replace: '      continue;',
    }],
  },
  {
    id: 'invariant-accepts-dead-space-reference',
    guard: 'node --test --test-name-pattern="маркер на удалённое пространство" '
      + 'test/model-invariants.test.mjs',
    because: 'маркер, привязанный к удалённому пространству, исчезает с плана молча (#244): '
      + 'проверка ссылок обязана считать это дефектом операции, а не особенностью данных (#254)',
    patches: [{
      file: 'scripts/model-invariants.mjs',
      find: '    if (space && !spaceIds.has(space)) {\n      add(\'marker_space\'',
      replace: '    if (false) {\n      add(\'marker_space\'',
    }],
  },
  {
    id: 'wall-face-apply-skips-overlap-guard',
    guard: 'node demo/smoke_wall_face_overlap.mjs',
    because: 'вторая проверка при создании — не дубль первой, а defense-in-depth из #173 §10.3: '
      + 'решение принимается в диалоге, а геометрия к моменту применения может стать другой '
      + '(#177)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '      const clash = existingRooms.find((room) => room.id !== ownSplit',
      replace: '      const clash = [].find((room) => room.id !== ownSplit',
    }],
  },
  {
    id: 'docs-fixture-splits-posix-only',
    guard: 'node --test --test-name-pattern="не зависит от разделителя платформы" '
      + 'test/docs-accept.test.mjs',
    because: 'фикстура приёмки разбирала путь только по «/» и на Windows отдавала весь путь '
      + 'вместо имени файла: три проверки краснели на верной реализации, а Linux этого не '
      + 'видел вовсе — регресс обязан краснеть на любой платформе (#247)',
    patches: [{
      file: 'test/docs-accept.test.mjs',
      find: "export const basename = (path) => String(path).split(/[\\\\/]/).filter(Boolean).pop() ?? '';",
      replace: "export const basename = (path) => String(path).split('/').pop() ?? '';",
    }],
  },
  {
    id: 'docs-accept-takes-any-chromium',
    guard: 'node --test --test-name-pattern="без названного Chromium" test/docs-accept.test.mjs',
    because: 'набор, снятый другим браузером, переписывает все десять картинок без единого '
      + 'содержательного изменения, поэтому окружение съёмки — часть доказательства, а не '
      + 'украшение манифеста (#246)',
    patches: [{
      file: 'scripts/docs-accept.mjs',
      find: "  if (typeof manifest.chromium !== 'string' || !manifest.chromium.trim())",
      replace: '  if (false)',
    }],
  },
  {
    id: 'docs-accept-copies-before-checking',
    guard: 'node --test --test-name-pattern="отсутствующий в артефакте файл" '
      + 'test/docs-accept.test.mjs',
    because: 'половина принятого набора хуже непринятого: на плане окажется картинка от одного '
      + 'дерева рядом с манифестом от другого, и check-docs покажет одну ошибку вместо десяти '
      + '(#246)',
    patches: [{
      file: 'scripts/docs-accept.mjs',
      find: "      throw new Error(`${scenario.id}: в артефакте нет файла ${entry.file || '(без имени)'}`);",
      replace: '      continue;',
    }],
  },
  {
    id: 'docs-fingerprint-sees-product-version',
    guard: 'node --test --test-name-pattern="не трогает отпечаток скриншотов" '
      + 'test/source-fingerprint.test.mjs',
    because: 'номер версии продукта на скриншотах не нарисован, и если отпечаток документации '
      + 'снова начнёт его видеть, каждый релизный коммит будет оставлять job docs красным — '
      + 'красный гейт, который «всегда такой», перестают читать (#245)',
    patches: [{
      file: 'scripts/source-fingerprint.mjs',
      find: '    ? (text) => text.split(version).join(\'0.0.0-product-version\')',
      replace: '    ? (text) => text',
    }],
  },
  {
    id: 'smoke-select-drops-registered-link',
    guard: 'node --test --test-name-pattern="держится на зарегистрированной связи" '
      + 'test/smoke-select.test.mjs',
    because: 'связь «изменённый контракт → смок, который его не называет» доказать поиском '
      + 'нельзя, и держится она только на реестре: без записи выборка по диффу #234 снова '
      + 'промолчит о smoke_wall_thickness_transition — том самом классе смоков, на котором '
      + '#234 потерял регресс (#241)',
    patches: [{
      file: 'scripts/smoke-links.mjs',
      find: "    symbols: ['chainSegmentCms', 'wallChainSegments', '_draftSegmentCms', '_closingWallCm'],",
      replace: '    symbols: [],',
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
    id: 'optimize-storage-boundary-removed',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 248 Optimize stays" '
      + 'test/plan-optimizer.test.mjs',
    because: 'Optimize must remove near-node tails before visible Align so storage-only cleanup '
      + 'is not misreported as a user-visible move and the exact candidate survives reload (#291)',
    patches: [{
      file: 'src/plan-optimizer.ts',
      find: '  canonicalizeConfigGeometryInPlace(config);\n'
        + '  canonicalizeLayoutGeometryInPlace(references.layout);',
      replace: '  // mutant: skip the pre-Align lattice boundary',
    }],
  },
  {
    id: 'optimize-config-storage-half-raw',
    guard: 'node scripts/backend-test-guard.mjs storage_helpers_are_the_final_canonical_barrier '
      + 'tests_backend/test_coordinate_canonicalization.py',
    because: 'the durable config half must remain the exact canonical target recorded by '
      + 'Optimize intent even for internal writers which bypass WebSocket schema (#248)',
    patches: [{
      file: 'custom_components/houseplan/store.py',
      find: '    canonical_config = canonicalize_config_geometry(config)',
      replace: '    canonical_config = config',
    }],
  },
  {
    id: 'optimize-layout-storage-half-raw',
    guard: 'node scripts/backend-test-guard.mjs storage_helpers_are_the_final_canonical_barrier '
      + 'tests_backend/test_coordinate_canonicalization.py',
    because: 'the durable layout half must remain the exact canonical target recorded by '
      + 'Optimize intent even for internal writers which bypass WebSocket schema (#248)',
    patches: [{
      file: 'custom_components/houseplan/store.py',
      find: '    out["layout"] = canonicalize_layout_geometry(layout)',
      replace: '    out["layout"] = layout',
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
    id: 'schema-quantization-removed',
    guard: 'node scripts/backend-test-guard.mjs backend_schemas_apply '
      + 'tests_backend/test_coordinate_canonicalization.py',
    because: 'backend schemas are the public write door for cards, imports and manual clients; '
      + 'removing their canonicalisation would let the same ULP noise enter every future writer',
    patches: [{
      file: 'custom_components/houseplan/validation.py',
      find: '        extra=vol.ALLOW_EXTRA,  # unknown (legacy) keys do not break loading\n'
        + '    ),\n    canonicalize_config_geometry,\n)',
      replace: '        extra=vol.ALLOW_EXTRA,  # unknown (legacy) keys do not break loading\n'
        + '    ),\n    lambda value: value,\n)',
    }],
  },
  {
    id: 'frontend-writes-raw-coords',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="frontend write paths" '
      + 'test/coordinate-canonicalization.test.mjs',
    because: 'a server-only fix leaves the open card rendering its noisy mutable config until '
      + 'reload, so the current session can still reproduce the geometry failure after Save',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '      const candidate = canonicalizeConfigGeometry(this._serverCfg);',
      replace: '      const candidate = this._serverCfg;',
    }],
  },
  {
    id: 'quantization-hits-allowlist',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="scalar\\+lattice fixture contract" '
      + 'test/coordinate-canonicalization.test.mjs',
    because: 'presentation and calibration values are deliberately outside geometry; widening '
      + 'the allow-list silently changes user data that has no ULP topology problem',
    patches: [{
      file: 'src/coordinate-canonicalization.ts',
      find: "  for (const marker of records(root.markers)) scalarFields(marker, ['angle']);",
      replace: "  for (const marker of records(root.markers)) scalarFields(marker, ['angle', 'size']);",
    }],
  },
  {
    id: 'lattice-round-truncates',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="all 4801 lattice nodes" '
      + 'test/coordinate-canonicalization.test.mjs',
    because: 'truncating toward zero maps every negative and fractional node to the wrong exact '
      + 'double, recreating topology drift even though the output still looks grid-like (#291)',
    patches: [{
      file: 'src/coordinate-canonicalization.ts',
      find: '  const scaled = value * LATTICE_GRID_N;\n'
        + '  const nearest = Math.round(scaled);\n'
        + '  const deviation = Math.abs(scaled - nearest);',
      replace: '  const scaled = value * LATTICE_GRID_N;\n'
        + '  const nearest = Math.trunc(scaled);\n'
        + '  const deviation = Math.abs(scaled - nearest);',
    }],
  },
  {
    id: 'python-lattice-round-truncates',
    guard: 'node scripts/backend-test-guard.mjs all_4801_lattice_nodes '
      + 'tests_backend/test_coordinate_canonicalization.py',
    because: 'the backend must use the JavaScript Math.round tie direction and nearest-node '
      + 'semantics; truncation would make old-client writes diverge from the card (#291)',
    patches: [{
      file: 'custom_components/houseplan/coordinate_canonicalization.py',
      find: '    nearest = math.floor(scaled + 0.5)',
      replace: '    nearest = math.trunc(scaled)',
    }],
  },
  {
    id: 'lattice-noise-threshold-too-small',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="all 4801 lattice nodes" '
      + 'test/coordinate-canonicalization.test.mjs',
    because: 'a threshold below the measured nine-decimal tail leaves the real 1/240 noise '
      + 'population intact while nominal exact nodes continue to pass (#291)',
    patches: [{
      file: 'src/coordinate-canonicalization.ts',
      find: 'export const LATTICE_NOISE_STEPS = 1e-4;',
      replace: 'export const LATTICE_NOISE_STEPS = 1e-9;',
    }],
  },
  {
    id: 'lattice-noise-threshold-too-large',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="all 4801 lattice nodes" '
      + 'test/coordinate-canonicalization.test.mjs',
    because: 'a broad threshold silently attracts authored off-grid geometry instead of only '
      + 'removing the measured storage tail (#291)',
    patches: [{
      file: 'src/coordinate-canonicalization.ts',
      find: 'export const LATTICE_NOISE_STEPS = 1e-4;',
      replace: 'export const LATTICE_NOISE_STEPS = 0.5;',
    }],
  },
  {
    id: 'lattice-layout-allowlist-omitted',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="scalar\\+lattice fixture contract" '
      + 'test/coordinate-canonicalization.test.mjs',
    because: 'config-only canonicalization lets marker and room-label writes recreate the same '
      + 'noise through the independent layout Store (#291)',
    patches: [{
      file: 'src/coordinate-canonicalization.ts',
      find: '  for (const value of Object.values(root)) {\n'
        + '    const item = record(value);\n'
        + "    if (item) latticeFields(item, ['x', 'y']);\n"
        + '  }\n  return result;',
      replace: '  // mutant: omit all layout x/y values\n  return result;',
    }],
  },
  {
    id: 'lattice-unknown-fields-recursive',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="scalar\\+lattice fixture contract" '
      + 'test/coordinate-canonicalization.test.mjs',
    because: 'recursively rounding future, physical and calibration numbers corrupts data which '
      + 'is deliberately outside the persisted coordinate allow-list (#291)',
    patches: [{
      file: 'src/coordinate-canonicalization.ts',
      find: '  }\n  return value;\n}\n\n/** Existing scalar contract',
      replace: '  }\n  return canonicalizeNumber(value);\n}\n\n/** Existing scalar contract',
    }],
  },
  {
    id: 'import-path-bypasses-schema',
    guard: 'node scripts/backend-test-guard.mjs import_document_canonicalizes_external_coordinates',
    because: 'an externally assembled backup is an independent source of noisy geometry and '
      + 'must enter preview and storage through the same canonical schema as the live card',
    patches: [{
      file: 'custom_components/houseplan/import_export.py',
      find: '        config = CONFIG_SCHEMA(_json_copy(payload.get("config")))',
      replace: '        config = _json_copy(payload.get("config"))',
    }],
  },
  {
    id: 'wall-component-failure-kills-primary',
    guard: 'node demo/smoke_wall_union_isolation.mjs',
    because: 'a local shell/extra merge failure must remain a render-safe component set instead '
      + 'of restoring the all-or-nothing blank wall layer from #278',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: "      status: degradedExtraCount || degradedCoreCount ? 'degraded-extra' : 'ok',",
      replace: "      status: degradedExtraCount || degradedCoreCount ? 'failed-core' : 'ok',",
    }],
  },
  {
    id: 'wall-isolated-extra-discarded',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="isolates one failed independent-body" '
      + 'test/wall-thickness.test.mjs',
    because: 'keeping only the primary makes the floor look mostly repaired while silently '
      + 'dropping the exact independent body whose union failed (#278)',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '          isolated.push({ id: `extra-${index}`, geom: standalone });',
      replace: '          // mutant: discard the valid isolated body',
    }],
  },
  {
    id: 'strict-wall-barrier-accepts-degraded',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="strict one-space barrier" '
      + 'test/plan-geometry-preflight.test.mjs',
    because: 'render-safe degradation is read compatibility, never permission to persist another '
      + 'geometry mutation over the unsafe candidate (#278)',
    patches: [{
      file: 'src/plan-geometry-preflight.ts',
      find: "      if (united.status === 'degraded-extra') {",
      replace: "      if (false && united.status === 'degraded-extra') {",
    }],
  },
  {
    id: 'wall-thickness-writer-bypasses-common-barrier',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="production source routes physical writers" '
      + 'test/wall-union-isolation.test.mjs',
    because: 'one direct physical writer is enough to recreate the corrupt persisted geometry '
      + 'even when Resize and the other editors use the shared transaction boundary (#278)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: "    if (this._commitPhysicalGeometry(this._t('history.wall_thickness'), before))",
      replace: "    if ((this._recordGeometry(this._t('history.wall_thickness'), before), true))",
    }],
  },
  {
    id: 'model-invariants-bypasses-production-geometry',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="Optimize and model-invariants" '
      + 'test/wall-union-isolation.test.mjs',
    because: 'the CLI must fail on the same degraded result as Optimize instead of returning the '
      + 'pre-#278 false green for a visually broken export',
    patches: [{
      file: 'scripts/model-invariants.mjs',
      find: '  return result.failures.map((failure, index) => ({',
      replace: '  return [].map((failure, index) => ({',
    }],
  },
  {
    id: 'optimize-preflight-bypassed',
    guard: 'node demo/smoke_optimize_geometry_preflight.mjs',
    because: 'a red preview must remain a hard write barrier even if a caller invokes the '
      + 'private Apply method directly instead of clicking the deliberately absent button (#199)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    if (!d || d.busy || !this._serverCfg || !d.changed || !d.preflight?.ok) return;',
      replace: '    if (!d || d.busy || !this._serverCfg || !d.changed) return;',
    }],
  },
  {
    id: 'optimize-preflight-active-space-only',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="one failed space blocks" '
      + 'test/plan-geometry-preflight.test.mjs',
    because: 'Optimize is one whole-plan transaction, so a broken non-active floor must block '
      + 'the operation just as decisively as the first floor in config order (#199)',
    patches: [{
      file: 'src/plan-geometry-preflight.ts',
      find: '  const rawSpaces = Array.isArray(config?.spaces) ? config.spaces : [];',
      replace: '  const rawSpaces = Array.isArray(config?.spaces) ? config.spaces.slice(0, 1) : [];',
    }],
  },
  {
    id: 'optimize-preflight-accepts-null',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="null, exceptions and floor failure" '
      + 'test/plan-geometry-preflight.test.mjs',
    because: 'wallBodiesGeometry null is a structural boolean failure, not an empty successful '
      + 'wall set that may be hidden behind a later floor fallback (#199)',
    patches: [{
      file: 'src/plan-geometry-preflight.ts',
      find: '      if (united == null) {',
      replace: '      if (false && united == null) {',
    }],
  },
  {
    id: 'optimize-preflight-renders-apply-on-failure',
    guard: 'node demo/smoke_optimize_geometry_preflight.mjs',
    because: 'the failure state is not a dismissible warning: rendering Apply invites a person '
      + 'to treat an unsafe whole-plan candidate as an accepted risk (#199)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '          ${!d.changed || !d.preflight?.ok ? nothing : html`',
      replace: '          ${!d.changed ? nothing : html`',
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
    id: 'near-axis-threshold-weakened',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="#290 near-axis boundary" test/near-axis.test.mjs',
    because: 'the measured 316x1 wall must stay inside the one shared 0.25 degree drafting '
      + 'tolerance while 316x2 and a true diagonal remain outside (#290)',
    patches: [{
      file: 'src/near-axis.ts',
      find: 'export const NEAR_AXIS_MAX_DEGREES = 0.25;',
      replace: 'export const NEAR_AXIS_MAX_DEGREES = 0.1;',
    }],
  },
  {
    id: 'near-axis-inclusive-boundary-disabled',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="#290 near-axis boundary" test/near-axis.test.mjs',
    because: 'the product contract includes an edge exactly on the 0.25 degree boundary (#290)',
    patches: [{
      file: 'src/near-axis.ts',
      find: '  if (minor / major > NEAR_AXIS_MAX_SLOPE) return null;',
      replace: '  if (minor / major >= NEAR_AXIS_MAX_SLOPE) return null;',
    }],
  },
  {
    id: 'near-axis-authoring-snap-bypassed',
    guard: 'npm run bundle:sync && node demo/smoke_plan_drawing_repairs.mjs',
    because: 'the production Walls hover and click must persist the exact same straight endpoint '
      + 'instead of merely repairing old data through Optimize (#290)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    const point = anchor ? snapNearAxisEndpoint(anchor, snapped) : snapped;',
      replace: '    const point = snapped;',
    }],
  },
  {
    id: 'near-axis-shared-owner-repair-partial',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="#290 repairs a duplicated" test/near-axis.test.mjs',
    because: 'a shared physical wall must move every coincident room-owner copy atomically (#290)',
    patches: [{
      file: 'src/near-axis.ts',
      find: 'const replaceRoomPoints = (rooms: any[], move: EndpointMove): any[] => rooms.map((room) => {',
      replace: 'const replaceRoomPoints = (rooms: any[], move: EndpointMove): any[] => rooms.map((room, index) => {\n'
        + '  if (index > 0) return room;',
    }],
  },
  {
    id: 'near-axis-shared-owner-double-counted',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="#290 repairs a duplicated" test/near-axis.test.mjs',
    because: 'coincident room-owner copies are one physical wall in the Optimize report (#290)',
    patches: [{
      file: 'src/near-axis.ts',
      find: '      const key = segmentKey(a, b);',
      replace: '      const key = `${segmentKey(a, b)}:${candidates.size}`;',
    }],
  },
  {
    id: 'near-axis-optimize-confirmation-bypassed',
    guard: 'npm run bundle:sync && node demo/smoke_near_axis_optimize.mjs',
    because: 'opening the Optimize preview or cancelling it must never persist a lossy repair (#290)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '  private _openAlignDialog = (): void => this._previewAlignDialog(false);',
      replace: '  private _openAlignDialog = (): void => {\n'
        + '    this._previewAlignDialog(false);\n'
        + '    void this._runAlignToGrid();\n'
        + '  };',
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
    id: 'wall-compaction-owner-role-bypassed',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="#299" test/wall-thickness.test.mjs',
    because: 'equal centimetres must not merge shared(A,B) with outer(A) or shared(A,C); '
      + 'dropping the owner signature recreates the mixed-role wall record from #299',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '          if (pr.kinds[next] === null || pr.cms[next] !== cm\n'
        + '              || ownerSignatureFor(nextKey) !== ownerSignature) break;',
      replace: '          if (pr.kinds[next] === null || pr.cms[next] !== cm) break;',
    }],
  },
  {
    id: 'optimizer-single-topology-island-blocked',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 273 Optimize" '
      + 'test/plan-optimizer.test.mjs',
    because: 'a proven 22→15→22 island beside exactly one room T-node must not survive '
      + 'merely because the old #198 guard classified both endpoints identically',
    patches: [{
      file: 'src/plan-optimizer.ts',
      find: '        if (isNode(a, roomNodes) && isNode(b, roomNodes)) continue;',
      replace: '        if (isNode(a, roomNodes) || isNode(b, roomNodes)) continue;',
    }],
  },
  {
    id: 'optimizer-coincident-opening-rehost-disabled',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 276 reconciles" '
      + 'test/coincident-partitions.test.mjs',
    because: 'removing the redundant independent wall without materialising its hosted opening '
      + 'would leave a dangling host and make the door disappear after explicit Optimize (#276)',
    patches: [{
      file: 'src/coincident-partitions.ts',
      find: '    const nextOpenings = openings.map((opening) => openingReplacement.get(opening.id) || opening);',
      replace: '    const nextOpenings = openings.map((opening) => opening);',
    }],
  },
  {
    id: 'optimizer-coincident-residual-dropped',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="covered middle" '
      + 'test/optimize-hidden-obstacles.test.mjs',
    because: 'piecewise Optimize may absorb only the exactly covered middle of an independent '
      + 'wall and must preserve both free residual spans with stable identifiers (#296)',
    patches: [{
      file: 'src/coincident-partitions.ts',
      find: '    const residualRuns = runs.filter((run) => !run.safe);',
      replace: '    const residualRuns: PieceRun[] = [];',
    }],
  },
  {
    id: 'optimizer-coincident-max-thickness-lost',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="max thickness independently" '
      + 'test/optimize-hidden-obstacles.test.mjs',
    because: 'each absorbed piece must retain the thicker of room masonry and the hidden '
      + 'partition instead of silently thinning an authored wall (#296)',
    patches: [{
      file: 'src/coincident-partitions.ts',
      find: '      const finalCm = proofOk ? Math.max(roomCm, source.cm) : source.cm;',
      replace: '      const finalCm = proofOk ? roomCm : source.cm;',
    }],
  },
  {
    id: 'optimizer-backend-trusts-frontend-delta',
    guard: 'node scripts/backend-test-guard.mjs '
      + 'backend_proves_full_partition_delta_without_openings tests_backend/test_validation.py',
    because: 'the backend must reconstruct every removed partition atom independently; '
      + 'trusting the frontend candidate lets a no-opening partition disappear without masonry (#296)',
    patches: [{
      file: 'custom_components/houseplan/validation.py',
      find: 'def _safe_optimize_partition_delta(space: dict, old_partition: dict) -> bool:\n'
        + '    """Independently prove every removed atom of one old partition axis."""\n'
        + '    if not _known_optimize_partition(old_partition):',
      replace: 'def _safe_optimize_partition_delta(space: dict, old_partition: dict) -> bool:\n'
        + '    """Independently prove every removed atom of one old partition axis."""\n'
        + '    return True\n'
        + '    if not _known_optimize_partition(old_partition):',
    }],
  },
  {
    id: 'hidden-diagnostic-under-virtual-walls',
    guard: 'node demo/smoke_plan_snap_overlay.mjs',
    because: 'hidden wall axes and source endpoints must remain visible above every real and '
      + 'virtual wall body while staying below transient tool previews (#296)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '            ${this._editing ? this._renderOpenWalls(disp) : nothing}\n'
        + '            ${this._markup ? svg`<g class="hp-editor-only-layer"\n'
        + '              opacity="${modeVisual?.editorWeight ?? 1}">${this._renderHiddenWallDiagnosticOverlay()}</g>` : nothing}',
      replace: '            ${this._markup ? svg`<g class="hp-editor-only-layer"\n'
        + '              opacity="${modeVisual?.editorWeight ?? 1}">${this._renderHiddenWallDiagnosticOverlay()}</g>` : nothing}\n'
        + '            ${this._editing ? this._renderOpenWalls(disp) : nothing}',
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
    id: 'decor-restored-below-room-fills',
    guard: 'node demo/smoke_decor_layer_order.mjs',
    because: 'moving decor back before room fills reproduces #231: opaque custom floors, room '
      + 'hover and Glow base erase stored decor even though the decor group still exists in the DOM; '
      + 'the raster probes must catch the visual regression, including the filled opening tunnel',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: "            ${''/* Decor is one composition layer above every floor treatment\n"
        + '                   (room fill/hover, opening tunnels and Glow base) and below\n'
        + '                   live lighting, physical plan geometry and devices. Keep\n'
        + '                   hide_decor visual-only: the decor editor must always paint\n'
        + '                   stored shapes so they remain editable. */}\n'
        + "            ${disp.hideDecor && this._mode !== 'decor' ? nothing : this._renderDecorLayer()}\n",
      replace: '',
    }, {
      file: 'src/houseplan-card.ts',
      find: '            ${(() => {\n'
        + '              // audit L1: hoisted out of the per-room map — these depend on the',
      replace: "            ${disp.hideDecor && this._mode !== 'decor' ? nothing : this._renderDecorLayer()}\n"
        + '            ${(() => {\n'
        + '              // audit L1: hoisted out of the per-room map — these depend on the',
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
      find: '            ${glowLayerVisible ? this._renderGlowLayer(space, disp) : nothing}',
      replace: '            ${!space.bg && !disp.showNames && !this._markup ? svg`<g class="room-svg-labels" pointer-events="none">${space.rooms.map((room) => {\n'
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
    id: 'controller-availability-follows-target',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 251 separates controller availability" '
      + 'test/device-presentation.test.mjs',
    because: 'a live controller must not inherit unavailable from its controlled lamp; '
      + 'the focused matrix keeps own availability and target working as separate facts (#251)',
    patches: [{
      file: 'src/device-presentation.ts',
      find: "  let visual = controllerFace\n"
        + "    ? { ...combined, availability: controllerAvailability(hass, d) }",
      replace: "  let visual = controllerFace\n    ? combined",
    }],
  },
  {
    id: 'controller-diagnostics-do-not-prove-online',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 251 separates controller availability" '
      + 'test/device-presentation.test.mjs',
    because: 'battery, LQI and update are the available evidence for event-only wireless '
      + 'controllers; excluding those siblings restores the field defect (#251)',
    patches: [{
      file: 'src/device-presentation.ts',
      find: '  const live = (d.entities || []).some((eid) => {',
      replace: "  const live = (d.entities || []).filter((eid) => !eid.startsWith('sensor.') "
        + "&& !eid.startsWith('update.')).some((eid) => {",
    }],
  },
  {
    id: 'wireless-controller-loses-filtered-target-role',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 274 keeps a wireless controller" '
      + 'test/device-presentation.test.mjs',
    because: 'a saved target tombstone may empty the runtime light graph without turning the '
      + 'physical controller into its event-only primary; live diagnostics still prove online (#274)',
    patches: [{
      file: 'src/device-presentation.ts',
      find: "  const controllerFace = sources.sourceKind === 'controls'\n"
        + "    || (configuredController && sources.sourceKind !== 'light' && sources.sourceKind !== 'cover');",
      replace: "  const controllerFace = sources.sourceKind === 'controls';",
    }],
  },
  {
    id: 'wireless-controller-preview-drops-sibling-markers',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 274 keeps a wireless controller" '
      + 'test/device-presentation.test.mjs',
    because: 'the draft must inherit the same tombstones and ownership roster as the saved plan; '
      + 'isolating it restores the plan/preview contradiction (#274)',
    patches: [{
      file: 'src/devices.ts',
      find: '  const markers = [\n'
        + '    ...siblingMarkers.filter((item) => item.id !== marker.id),\n'
        + '    marker,\n'
        + '  ];',
      replace: '  const markers = [marker];',
    }],
  },
  {
    id: 'unavailable-toggle-stays-silent',
    guard: 'node demo/smoke_controls.mjs',
    because: 'a configured group with no available target must explain the safe no-op instead '
      + 'of returning silently before service, confirmation and press feedback (#251)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '        this._showUnavailableToggleTargets(initial);',
      replace: '        // Mutant: restore the historical quiet no-op.',
    }],
  },
  {
    id: 'partial-group-shows-noop-toast',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 251 classifies only unavailable" '
      + 'test/device-toggle.test.mjs',
    because: 'a partial group did execute its available subset and must never claim that no '
      + 'action happened merely because another target was skipped (#251)',
    patches: [{
      file: 'src/device-toggle.ts',
      find: "  if (!intent || intent.kind !== 'group' || toggleOperation(intent)\n"
        + "      || intent.noneReason !== 'configured-targets-missing') return [];",
      replace: "  if (!intent || intent.kind !== 'group') return [];",
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
    id: 'junction-fans-disabled',
    // Юниты формы, не детектор: контрактные пробы детектора строятся из той
    // же функции и слепнут вместе с ней, а «T-узел даёт два веера» — внешняя
    // истина, не зависящая от мутируемого кода.
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 302" test/wall-thickness.test.mjs',
    because: 'без вееров сектор между соседними полосами узла остаётся дырой — '
      + 'это и есть класс артефактов #302',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '      if (mitre) {\n        push([[P[0], P[1]], EA, mitre, EB]);\n        continue;\n      }',
      replace: '      if (mitre) {\n        continue;\n      }',
    }, {
      file: 'src/wall-thickness.ts',
      find: '      push([[P[0], P[1]], EA, A2, B2, EB]);',
      replace: '      void A2; void B2;',
    }],
  },
  {
    id: 'junction-supports-not-restored',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test --test-name-pattern="hole-free end to end" test/wall-thickness.test.mjs',
    because: 'фаска старого слоя срезает материал полос на острых стыках; '
      + 'без возврата саппорт-квадов узла репро владельца снова дырявое',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '      for (const piece of [...corners.supports, ...corners.fans]) {',
      replace: '      for (const piece of corners.fans) {',
    }],
  },
  {
    id: 'junction-fan-ignores-thick-length',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test --test-name-pattern="issue 302" test/wall-thickness.test.mjs',
    because: 'mitre, шагнувший за короткий толстый саппорт, рисует латеральный '
      + 'фантом рядом с тонким продолжением (#271)',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '          : tA > 1e-9 && tA <= A.thickLength && tB <= B.thickLength;',
      replace: '          : tA > 1e-9;',
    }],
  },
  {
    id: 'junction-reflex-outer-mitre-missing',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test --test-name-pattern="issue 302" test/wall-thickness.test.mjs',
    because: 'рефлексный сектор — наружный угол между крайними лучами; без '
      + 'обратного mitre там остаётся вырез Y-60 из отчёта владельца',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '        const directionOk = reflex\n          ? tA <= 1e-9 && tB <= 1e-9',
      replace: '        const directionOk = reflex\n          ? false',
    }],
  },
  {
    id: 'junction-fan-limit-back-to-249',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test --test-name-pattern="issue 302" test/wall-thickness.test.mjs',
    because: 'лимит веера 1.25·h — это отставка решения №5: узлы снова с '
      + 'вырезами и ступеньками вместо полного mitre',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '      const limit = MITRE_LIMIT * Math.max(A.halfDepth, B.halfDepth);\n      // Facing strip edges',
      replace: '      const limit = node.limit;\n      // Facing strip edges',
    }],
  },
  {
    id: 'junction-detector-blind',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test --test-name-pattern="issue 302" test/wall-thickness.test.mjs',
    because: 'слепой детектор превращает инвариант «нет дыр» в декорацию — '
      + 'самопроверка на заведомо дырявой фикстуре обязана краснеть',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '        if (!inGeometry(geometry, x, y)) holes.push([x, y]);',
      replace: '        void x; void y;',
    }],
  },
  {
    id: 'junction-pieces-unbounded',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="concave vertex" test/wall-thickness.test.mjs',
    because: 'куски узла без клипа гладкой фасадной границей отращивают новый '
      + 'фасад на вогнутой вершине',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '          if (bound) ring = intersection(ring, bound);',
      replace: '          void bound;',
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
    id: 'tab-drag-target-follows-captured-source',
    guard: 'node demo/smoke_space_tab_reorder.mjs',
    because: 'pointer capture keeps pointermove targeted at the held tab; resolving the drop '
      + 'from that event target reproduces #243, where a real mouse can never reach another tab',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    const target = this._tabDropTargetAt(event.clientX, event.clientY, drag.id);',
      replace: '    const target = this._tabDropTargetAt(drag.x, drag.y, drag.id);',
    }],
  },
  {
    id: 'tab-drop-indicator-always-before',
    guard: 'node demo/smoke_space_tab_reorder.mjs',
    because: 'a single undirected marker cannot tell whether the held space will land before '
      + 'or after the target; #243 requires the divider on the actual insertion side',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: "      return { targetId, placement: targetIndex < sourceIndex ? 'before' : 'after' };",
      replace: "      return { targetId, placement: 'before' };",
    }],
  },
  {
    id: 'tab-drop-outside-commits-last-target',
    guard: 'node demo/smoke_space_tab_reorder.mjs',
    because: 'leaving the tab strip must clear the preview and make release a no-op; retaining '
      + 'the last target makes an outside drop reorder spaces unexpectedly',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: `      targetId: target?.targetId || null,
      placement: target?.placement || null,`,
      replace: `      targetId: target?.targetId || drag.targetId,
      placement: target?.placement || drag.placement,`,
    }, {
      file: 'src/houseplan-card.ts',
      find: `    const target = event.type === 'pointerup' && drag?.moved
      ? this._tabDropTargetAt(event.clientX, event.clientY, drag.id)
      : null;`,
      replace: `    const target = event.type === 'pointerup' && drag?.moved
      ? drag.targetId ? { targetId: drag.targetId } : null
      : null;`,
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
      find: `    this._endTabDrag();
    clearTimeout(this._tabSuppressClickTimer);`,
      replace: '    clearTimeout(this._tabSuppressClickTimer);',
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
  {
    id: 'grid-scale-visual-factor-constant',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="visual scale preserves" test/grid-scale.test.mjs',
    because: 'the visual baseline is 5 cm per cell, so a finer coordinate grid must enlarge '
      + 'legacy SVG visual constants by the reciprocal factor (#239)',
    patches: [{
      file: 'src/grid-scale.ts',
      find: '  return GRID_VISUAL_REFERENCE_CELL_CM / value;',
      replace: '  return 1;',
    }],
  },
  {
    id: 'grid-scale-visual-factor-inverted',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="visual scale preserves" test/grid-scale.test.mjs',
    because: 'cell/5 shrinks visual constants on a finer grid, exactly reversing the physical '
      + 'equivalence contract (#239)',
    patches: [{
      file: 'src/grid-scale.ts',
      find: '  return GRID_VISUAL_REFERENCE_CELL_CM / value;',
      replace: '  return value / GRID_VISUAL_REFERENCE_CELL_CM;',
    }],
  },
  {
    id: 'grid-scale-opening-symbol-unscaled',
    guard: 'node demo/smoke_grid_scale_invariance.mjs',
    because: 'door leaves, window bars and gate panels are visual geometry and must keep the '
      + 'same screen footprint on physically equivalent grids (#239)',
    patches: [{
      file: 'src/render/opening-symbol.ts',
      find: '  const visualScale = gridVisualScale(spec.cellCm);',
      replace: '  const visualScale = 1;',
    }],
  },
  {
    id: 'grid-scale-opening-hit-unscaled',
    guard: 'node demo/smoke_grid_scale_invariance.mjs',
    because: 'the opening hover outline and action hitbox must not shrink when cell_cm becomes '
      + 'more precise; the smoke also clicks the real outer edge (#239)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '      const outlinePad = gridVisualUnits(10, this._cellCm);\n'
        + '      const hitPad = gridVisualUnits(12, this._cellCm);',
      replace: '      const outlinePad = 10;\n      const hitPad = 12;',
    }],
  },
  {
    id: 'grid-scale-plan-chrome-unscaled',
    guard: 'node demo/smoke_grid_scale_invariance.mjs',
    because: 'Plan architecture ink is visual chrome; leaving the wall outline at raw SVG units '
      + 'makes it five times thinner on a 1 cm grid (#239)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '        stroke="${stroke}" stroke-width="${gridVisualUnits(0.6, this._cellCm)}"',
      replace: '        stroke="${stroke}" stroke-width="0.6"',
    }],
  },
  {
    id: 'grid-scale-static-factor-missing',
    guard: 'node demo/smoke_grid_scale_invariance.mjs',
    because: 'the secondary space card shares visual CSS with the full card and must receive '
      + 'the same per-space factor instead of silently drifting (#239)',
    patches: [{
      file: 'src/space-render.ts',
      find: ';--hp-cell-visual-scale:${gridVisualScale(cellCm)}',
      replace: '',
    }],
  },
  {
    id: 'grid-scale-iso-height-unscaled',
    guard: 'node demo/smoke_grid_scale_invariance.mjs',
    because: 'hidden isometric wall and floor heights are visual geometry and must project to '
      + 'the same raster at 1 and 5 cm per cell (#239)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    const structural = source.build();\n'
        + '    const wallHeight = gridVisualUnits(ISO_WALL_HEIGHT, this._cellCm);\n'
        + '    const floorEdgeHeight = gridVisualUnits(ISO_FLOOR_EDGE_HEIGHT, this._cellCm);',
      replace: '    const structural = source.build();\n'
        + '    const wallHeight = ISO_WALL_HEIGHT;\n'
        + '    const floorEdgeHeight = ISO_FLOOR_EDGE_HEIGHT;',
    }],
  },
  {
    id: 'grid-scale-metric-default-five',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="new-space defaults" test/grid-scale.test.mjs',
    because: 'new metric spaces must start at 1 cm per cell; restoring the old 5 cm default '
      + 'would preserve the defect for every new plan (#239)',
    patches: [{
      file: 'src/grid-scale.ts',
      find: '  return imperial ? GRID_IMPERIAL_CELL_CM : 1;',
      replace: '  return imperial ? GRID_IMPERIAL_CELL_CM : 5;',
    }],
  },
  {
    id: 'grid-scale-imperial-default-wrong',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="new-space defaults" test/grid-scale.test.mjs',
    because: 'one imperial grid point means exactly one inch (2.54 canonical centimetres), '
      + 'not one centimetre (#239)',
    patches: [{
      file: 'src/grid-scale.ts',
      find: '  return imperial ? GRID_IMPERIAL_CELL_CM : 1;',
      replace: '  return imperial ? 1 : 1;',
    }],
  },
  {
    id: 'grid-scale-legacy-fallback-one',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="legacy space without cell_cm" test/canvas.test.mjs',
    because: 'missing cell_cm is stored-data compatibility and stays at the historical 5 cm; '
      + 'the new 1 cm value applies only at creation (#239)',
    patches: [{
      file: 'src/space-geometry.ts',
      find: '      cellCm: Number.isFinite(Number(s.cell_cm)) && Number(s.cell_cm) > 0\n'
        + '        ? Number(s.cell_cm) : 5,',
      replace: '      cellCm: Number.isFinite(Number(s.cell_cm)) && Number(s.cell_cm) > 0\n'
        + '        ? Number(s.cell_cm) : 1,',
    }],
  },
  {
    id: 'grid-scale-imperial-roundtrip-drift',
    guard: 'node demo/smoke_space_scale_defaults.mjs',
    because: 'the rounded imperial field is presentation only; saving it without an edit must '
      + 'not replace the exact canonical centimetre value (#239)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '      sp.cell_cm = Number.isFinite(d.cellCm) && d.cellCm > 0\n'
        + '        ? Math.max(CELL_CM_MIN, Math.min(CELL_CM_MAX, d.cellCm)) : 5;',
      replace: '      sp.cell_cm = gridCellFieldToCm(Number(d.cellCmInput), this._imperial);',
    }],
  },
  {
    id: 'grid-scale-physical-double-scaled',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="without double-scaling physical jambs" '
      + 'test/opening-symbol.test.mjs',
    because: 'wall-face depth is already converted from centimetres to render units; applying '
      + 'the visual factor again makes physical geometry five times too large (#239)',
    patches: [{
      file: 'src/render/opening-symbol.ts',
      find: '    ? ((spec.face.cm / spec.cellCm) * spec.gridPitch) / 2',
      replace: '    ? (((spec.face.cm / spec.cellCm) * spec.gridPitch) / 2) '
        + '* gridVisualScale(spec.cellCm)',
    }],
  },
  {
    id: 'opening-symbol-flip-restores-edge-offset',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test test/opening-symbol-placement.test.mjs '
      + 'test/opening-symbol.test.mjs test/iso-openings.test.mjs',
    because: 'a saved flip changes only opening direction; restoring the released #242 '
      + 'door/window edge translation moves the symbol off the wall centreline (#250)',
    patches: [{
      file: 'src/opening-symbol-placement.ts',
      find: '  return { ox: 0, oy: 0 };',
      replace: "  if (_flipV && (_type === 'door' || _type === 'window'))\n"
        + "    return { ox: 0, oy: Math.hypot(_face.ox, _face.oy) };\n"
        + '  return { ox: 0, oy: 0 };',
    }],
  },
  {
    id: 'opening-gate-flip-cancels-turn',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="shared renderer centres every flip" '
      + 'test/opening-symbol.test.mjs',
    because: 'restoring the second flip_v inversion makes shared and partition gates emit '
      + 'the same first-leaf turn sign for both saved values even though their origin stays centred',
    patches: [{
      file: 'src/render/opening-symbol.ts',
      find: '    const gateAngle = spec.face.side * 10 * amount;',
      replace: '    const gateAngle = spec.face.side * sy * 10 * amount;',
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
