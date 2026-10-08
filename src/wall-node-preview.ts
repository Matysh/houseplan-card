/** Local production geometry: remote, unchanged rooms never enter a pointer pass. */
import { svg, type TemplateResult } from 'lit';
import { GRID_PITCH, GRID_STEP_N, NORM_W, spaceModels } from './space-geometry';
import { islandsOf, outlineWithout, roomPoly } from './logic';
import { prepareSpacePhysicalGeometryInputs } from './plan-geometry-preflight';
import { innerContourForRoom, polyclipToPathD, wallBodiesGeometry, wallBodiesGeometryPath,
  wallBodyNeedsSolid, wallHatchNeedsSolid, wallHatchStepUnits, wallEdgeBodies } from './wall-thickness';
import { cleanFloorForRoom } from './clean-floor';
import { gridVisualUnits } from './grid-scale';
import { partitionOpeningFace } from './partition-openings';
import { openingInnerFaceOffsetFromIndex } from './wall-thickness';
import { renderOpeningVisibleGeometry } from './render/opening-symbol';
import { structuralNodeWalls, sameNodePoint, type NodeMoveSpace } from './wall-node-move';
import type { OpeningCfg, ServerConfig } from './types';
import { resolveZeroWalls } from './zero-walls';
import type { JunctionSharedGeometry } from './junction-limits';
import { wallQuadCovered } from './wall-quad-coverage';
import { subtractNodeRoomMasonry } from './wall-node-room-floor';
import { unionClippedWallCorners } from './wall-node-corners';
import { subtractNodeOpeningCuts } from './wall-node-openings';

type Bounds = [number, number, number, number];
const bounds = (points: readonly number[][], pad = 0): Bounds => [
  Math.min(...points.map(p => p[0])) - pad, Math.min(...points.map(p => p[1])) - pad,
  Math.max(...points.map(p => p[0])) + pad, Math.max(...points.map(p => p[1])) + pad,
];
const overlap = (a: Bounds, b: Bounds): boolean => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
const path = (points: number[][]): string => `M${points.map(p => p.join(' ')).join('L')}Z`;

/** Include changed owners and every nearby complete body on both sides of the
 * edit, not merely intersecting axes. The margin covers thickness and the
 * foreign-node clearance. Remote self-contained geometry is unchanged. */
export function nodeMoveLocalSpaces(before: NodeMoveSpace, next: NodeMoveSpace): [NodeMoveSpace, NodeMoveSpace] {
  const oldWalls = structuralNodeWalls(before), newWalls = structuralNodeWalls(next);
  const byId = new Map(oldWalls.map(w => [`${w.kind}:${w.id}`, w]));
  const changed = newWalls.filter(w => {
    const old = byId.get(`${w.kind}:${w.id}`);
    return !old || !sameNodePoint(old.a, w.a) || !sameNodePoint(old.b, w.b);
  });
  const changedIds = new Set(changed.map(w => w.id));
  const owners = [...before.rooms, ...next.rooms].filter(r => r.wall_ids?.some(id => changedIds.has(id)));
  const points = [...changed.flatMap(w => [w.a, w.b]), ...oldWalls.filter(w => changedIds.has(w.id)).flatMap(w => [w.a, w.b]),
    ...owners.flatMap(r => r.poly || [])];
  if (!points.length) return [before, next];
  const cm = Number(before.cell_cm) || 5;
  const pad = (Math.max(0, ...oldWalls.map(w => w.cm), ...newWalls.map(w => w.cm)) + 5) / cm * GRID_STEP_N;
  const region = bounds(points, pad);
  const rooms = [...before.rooms, ...next.rooms], bodies = [...oldWalls, ...newWalls];
  const roomBoxes = new Map(rooms.filter(r => r.poly?.length).map(r => [r, bounds(r.poly!, pad)]));
  const bodyBoxes = new Map(bodies.map(w => [w, bounds([w.a, w.b], pad)]));
  const roomIds = new Set(rooms.filter(r => r.poly?.length
    && overlap(bounds(r.poly), region)).map(r => r.id));
  const bodyIds = new Set([...oldWalls, ...newWalls].filter(w => changedIds.has(w.id)
    || overlap(bounds([w.a, w.b], w.cm / cm * GRID_STEP_N), region)).map(w => w.id));
  // Complete-body closure retains the unchanged far-end junction context too.
  // Separate boxes, rather than their global rectangle, avoid selecting remote
  // buildings merely because they sit between two ends of a long component.
  const boxes = [region], addedRooms = new Set<string>(), addedBodies = new Set<string>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const r of rooms) if (r.id && r.poly?.length && !addedRooms.has(r.id)
        && (roomIds.has(r.id) || boxes.some(box => overlap(roomBoxes.get(r)!, box)))) {
      roomIds.add(r.id); addedRooms.add(r.id); grew = true;
      for (const version of [before, next]) for (const own of version.rooms.filter(o => o.id === r.id)) {
        if (own.poly?.length) boxes.push(roomBoxes.get(own)!);
        for (const id of own.wall_ids || []) bodyIds.add(id);
      }
    }
    for (const w of bodies) if (!addedBodies.has(w.id)
        && (bodyIds.has(w.id) || boxes.some(box => overlap(bodyBoxes.get(w)!, box)))) {
      bodyIds.add(w.id); addedBodies.add(w.id); grew = true;
      for (const version of [oldWalls, newWalls]) for (const own of version.filter(o => o.id === w.id)) boxes.push(bodyBoxes.get(own)!);
    }
  }
  const select = (space: NodeMoveSpace): NodeMoveSpace => ({ ...space,
    rooms: space.rooms.filter(r => roomIds.has(r.id)),
    wall_segments: space.wall_segments?.filter(w => bodyIds.has(w.id)),
    partitions: space.partitions?.filter(w => bodyIds.has(w.id)),
    walls: space.walls?.filter(w => {
      if (!w.a || !w.b) return true;
      const own = bounds([w.a, w.b], pad); return boxes.some(box => overlap(own, box));
    }),
    wall_columns: Array.isArray(space.wall_columns) ? space.wall_columns.filter((column: { center: number[]; cm: number }) =>
      !Array.isArray(column.center) || boxes.some(box => overlap(bounds([column.center], column.cm / cm * GRID_STEP_N), box))) : space.wall_columns,
    openings: space.openings?.filter(o => o.host ? bodyIds.has(o.host.id) : boxes.some(box => overlap(bounds([[o.x, o.y]]), box))),
  });
  return [select(before), select(next)];
}

export function buildNodePreview(space: NodeMoveSpace) {
  const model = spaceModels({ spaces: [space] } as ServerConfig)[0];
  const input = prepareSpacePhysicalGeometryInputs(space, model);
  const geometry = wallBodiesGeometry(model.rooms, input.walls, input.openCuts, input.roomOpenings,
    GRID_STEP_N, input.cellCm, GRID_PITCH, NORM_W, input.physicalBodies,
    { coveredQuad: wallQuadCovered, clipCorners: unionClippedWallCorners, subtractOpenings: subtractNodeOpeningCuts,
      reuseExterior: true });
  return { space, model, input, geometry, renderRoomContours: new Map<string, number[][] | null>(),
    safe: geometry.status === 'ok' || geometry.status === 'not-applicable' };
}
export type NodePreviewGeometry = ReturnType<typeof buildNodePreview>;

/** The junction guard judges uncut room masonry in config units. The renderer
 * retains exactly that pre-opening/pre-independent-body component separately
 * from its visible, cut geometry. Explicit room open-spans change even that
 * component, so those candidates keep the independent canonical guard pass.
 * Never share the visible `geom`, its opening index, or render-unit node map. */
export function nodePreviewJunctionGeometry(preview: NodePreviewGeometry, captureForScene = true): JunctionSharedGeometry | undefined {
  const { input, geometry } = preview;
  if (input.openCuts.length || geometry.status !== 'ok'
      || input.coordScale !== NORM_W || input.gridPitch !== GRID_PITCH) return undefined;
  const roomGeom = geometry.roomGeom as number[][][][];
  return { status: 'ok', multiWallNodes: null,
    roomGeom: roomGeom.map(polygon => polygon.map(ring => ring.map(point => [point[0] / NORM_W, point[1] / NORM_W]))),
    subtractRoomMasonry: subtractNodeRoomMasonry,
    onRoomInnerContour: captureForScene ? (id, contour) => {
      // This private copy is produced only after the normalized guard judged
      // the same immutable candidate. Proof never consumes the scene cache.
      preview.renderRoomContours.set(id, contour ? contour.map(point =>
        [point[0] * NORM_W, point[1] * NORM_W]) : null);
    } : undefined,
  };
}
export interface NodePreviewScene {
  paper: TemplateResult; rooms: TemplateResult; walls: TemplateResult;
  roomIds: string[]; openingIds: string[]; oldZeroD: string[]; oldWallsD: string; oldPaperD: string;
}
export function nodePreviewScene(before: NodePreviewGeometry, next: NodePreviewGeometry,
  options: { px: number; color: string; fill: string; opacity: number; amount(o: OpeningCfg): number }): NodePreviewScene {
  const { model, input, geometry } = next;
  const united = wallBodiesGeometryPath(geometry);
  const solid = wallBodyNeedsSolid(geometry.depthUnits, options.px)
    || wallHatchNeedsSolid(wallHatchStepUnits(input.cellCm), options.px);
  const edgeCuts = wallEdgeBodies(model.rooms, input.walls, input.openCuts,
    GRID_STEP_N, input.cellCm, GRID_PITCH, NORM_W).map(w => [...w.a, ...w.b]);
  const zero = model.rooms.flatMap(r => {
    const p = roomPoly(r); return p ? outlineWithout(p, [...input.openCuts,
      ...edgeCuts], GRID_PITCH * .02) : [];
  });
  const roomShapes = model.rooms.map(r => {
    const own = roomPoly(r) || [];
    const inner = r.id ? (next.renderRoomContours.has(r.id) ? next.renderRoomContours.get(r.id)
      : innerContourForRoom(model.rooms, r.id, input.walls, input.openCuts,
        GRID_STEP_N, input.cellCm, GRID_PITCH, NORM_W, geometry.roomGeom, geometry.multiWallNodes)) || own : own;
    const holes = islandsOf(inner, model.rooms.filter(o => o !== r).flatMap(o => roomPoly(o) ? [roomPoly(o)!] : []));
    const clean = cleanFloorForRoom({ room: r, floor: inner, space: model, floorKey: () => model.id,
      resizePreview: true, cache: new Map(), physicalBodies: () => input.physicalBodies });
    return svg`<path class="room ${model.bg ? 'overlay' : 'yard'} outlined noedge" style="transition:none"
      d=${[clean.path || path(inner), ...holes.map(path)].join(' ')} fill-rule="evenodd" pointer-events="none"/>`;
  });
  const bodyless = resolveZeroWalls(next.space, model, NORM_W, GRID_PITCH * .02);
  return {
    paper: svg`<path class="hp-paper" d=${polyclipToPathD(geometry.paperGeom)} fill="white" fill-rule="evenodd"/>`,
    rooms: svg`${roomShapes}`,
    walls: svg`<g class="wallbodies" style="mask:url(#hp-node-ghost-mask)">
      ${united?.paths.map(c => svg`<path d=${c.d} fill=${options.fill} fill-opacity=${options.opacity} fill-rule="evenodd"/>
        <path d=${c.d} fill=${solid ? 'none' : 'url(#hp-wall-hatch)'} fill-rule="evenodd" stroke=${options.color} stroke-width=${gridVisualUnits(.6, input.cellCm)}/>`)}
      ${zero.map(s => svg`<path d=${`M${s[0]} ${s[1]}L${s[2]} ${s[3]}`} fill="none" stroke=${options.color} stroke-width="1" vector-effect="non-scaling-stroke"/>`)}
      <g class=${`zero-walls ${bodyless.style}`} style=${`--zero-wall-stroke:${options.color}`}>
      ${bodyless.lines.map(line => svg`<line class="zero-wall" x1=${line[0]} y1=${line[1]} x2=${line[2]} y2=${line[3]}/>`)}
      </g></g><g class="plan-snap-overlay" style="mask:url(#hp-node-ghost-mask)">
      ${structuralNodeWalls(next.space).map(w => svg`<line class="plan-snap-line"
        x1=${w.a[0] * NORM_W} y1=${w.a[1] * NORM_W} x2=${w.b[0] * NORM_W} y2=${w.b[1] * NORM_W}
        vector-effect="non-scaling-stroke" pointer-events="none"/>`)}</g><g class="openinglayer">${input.openings.map(o => {
        const flip = o.type === 'gate' ? !o.flip_v : !!o.flip_v;
        const face = o.partitionHost ? partitionOpeningFace(o.partitionHost, flip)
          : geometry.openingIndex ? openingInnerFaceOffsetFromIndex(geometry.openingIndex,
            { x: o.rx, y: o.ry, angle: o.angle, length: o.rlen, flip_v: flip })
            : { ox: 0, oy: 0, cm: 0, side: -1 as const };
        const previous = before.input.openings.find(p => p.id === o.id);
        const moving = !previous || Math.hypot(previous.rx - o.rx, previous.ry - o.ry) > 1e-6 || previous.angle !== o.angle;
        return svg`<g class="opening" data-hp="opening" data-id=${o.id} opacity=${moving ? '.5' : '1'}
          transform=${`translate(${o.rx} ${o.ry}) rotate(${o.angle})`}>${renderOpeningVisibleGeometry({
            type: o.type, length: o.rlen, angle: o.angle, amount: options.amount(o),
            flipH: !!o.flip_h, flipV: !!o.flip_v, base: options.color, tone: options.color,
            cellCm: input.cellCm, gridPitch: GRID_PITCH, face,
          })}</g>`;
      })}</g>`,
    roomIds: model.rooms.flatMap(r => r.id ? [r.id] : []),
    openingIds: input.openings.map(o => o.id),
    oldZeroD: structuralNodeWalls(before.space).filter(w => w.cm === 0).map(w =>
      `M${w.a.map(v => v * NORM_W).join(' ')}L${w.b.map(v => v * NORM_W).join(' ')}`),
    oldWallsD: polyclipToPathD(before.geometry.geom),
    oldPaperD: polyclipToPathD(before.geometry.paperGeom),
  };
}
