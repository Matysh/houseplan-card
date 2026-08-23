#!/usr/bin/env node
// External-backup regression probe for issue #275.
//
// Build test-build first (`npx tsc -p tsconfig.test.json` plus fix-test-build),
// then pass one or more plan-only backups. The files are read locally; their
// contents are never copied into the repository or printed.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { difference } from 'polyclip-ts';

import {
  canonicalizeConfigGeometry,
  canonicalizeLayoutGeometry,
} from '../test-build/coordinate-canonicalization.js';
import { optimizePlans } from '../test-build/plan-optimizer.js';
import { prepareSpacePhysicalGeometryInputs } from '../test-build/plan-geometry-preflight.js';
import { geometryArea } from '../test-build/physical-geometry.js';
import { spaceModels } from '../test-build/space-geometry.js';
import {
  buildMultiWallNodeMap,
  multiWallProtectedRayIndexes,
  multiWallProtectedStripGeometry,
  wallBodiesGeometry,
  wallIntervals,
} from '../test-build/wall-thickness.js';

const AREA_EPSILON = 1e-5;

const payloadOf = (backup) => {
  const payload = backup?.payload && typeof backup.payload === 'object'
    ? backup.payload
    : backup;
  const config = payload?.config && typeof payload.config === 'object'
    ? payload.config
    : payload;
  const layout = payload?.layout && typeof payload.layout === 'object'
    ? payload.layout
    : {};
  if (!config || !Array.isArray(config.spaces)) {
    throw new Error('input has no config.spaces');
  }
  return { config, layout };
};

const inspectConfig = (config) => {
  const before = JSON.stringify(config);
  const models = spaceModels(config);
  const spaces = [];
  for (let index = 0; index < config.spaces.length; index++) {
    const input = prepareSpacePhysicalGeometryInputs(config.spaces[index], models[index]);
    const geometry = wallBodiesGeometry(
      input.space.rooms,
      input.walls,
      input.openCuts,
      input.roomOpenings,
      input.wallKeyPitch,
      input.cellCm,
      input.gridPitch,
      input.coordScale,
      input.physicalBodies,
    );
    if (!geometry) throw new Error(`space ${index}: production wall geometry is null`);
    const map = buildMultiWallNodeMap(
      wallIntervals(
        input.space.rooms,
        input.walls,
        input.openCuts,
        input.wallKeyPitch,
        input.cellCm,
        input.gridPitch,
        input.coordScale,
      ),
      input.wallKeyPitch * input.coordScale * 0.04 * 4,
      input.coordScale,
    );
    const nodes = [];
    for (const node of map.nodes) {
      const protectedRays = multiWallProtectedRayIndexes(node);
      if (!protectedRays.length) continue;
      const required = multiWallProtectedStripGeometry(node, map);
      if (!required) throw new Error(`space ${index}: protected node has no strip geometry`);
      const roomMissingArea = geometryArea(difference(required, geometry.roomGeom));
      const paperMissingArea = geometryArea(difference(required, geometry.paperGeom));
      nodes.push({
        point: node.point.map((value) => value / input.coordScale),
        rays: node.rays.length,
        protectedRays: protectedRays.length,
        roomMissingArea,
        paperMissingArea,
        pass: roomMissingArea <= AREA_EPSILON && paperMissingArea <= AREA_EPSILON,
      });
    }
    spaces.push({
      index,
      degree3Nodes: map.nodes.length,
      protectedNodes: nodes.length,
      violations: nodes.filter((node) => !node.pass),
    });
  }
  if (JSON.stringify(config) !== before) throw new Error('geometry inspection mutated config');
  return {
    spaces,
    violations: spaces.reduce((total, space) => total + space.violations.length, 0),
  };
};

const inspectBackup = (path) => {
  const source = readFileSync(path);
  const backup = JSON.parse(source.toString('utf8'));
  const raw = payloadOf(backup);
  const optimized = optimizePlans(raw.config, raw.layout);
  const applied = {
    config: canonicalizeConfigGeometry(optimized.config),
    layout: canonicalizeLayoutGeometry(optimized.layout),
  };
  const reloaded = JSON.parse(JSON.stringify(applied));
  const states = {
    raw: inspectConfig(raw.config),
    preview: inspectConfig(optimized.config),
    applied: inspectConfig(applied.config),
    reloaded: inspectConfig(reloaded.config),
  };
  return {
    file: path,
    sha256: createHash('sha256').update(source).digest('hex'),
    optimizeChanged: optimized.changed,
    states,
    pass: Object.values(states).every((state) => state.violations === 0),
  };
};

const paths = process.argv.slice(2);
if (!paths.length) {
  console.error('usage: node scripts/wall-strip-containment.mjs <backup.json> [...]');
  process.exit(2);
}

const report = paths.map(inspectBackup);
console.log(JSON.stringify({ issue: 275, areaEpsilon: AREA_EPSILON, report }, null, 2));
if (report.some((entry) => !entry.pass)) process.exitCode = 1;
