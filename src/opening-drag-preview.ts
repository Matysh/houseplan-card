/** Transient opening masonry: retain the settled floor, recut only host patches. */
import { svg, type TemplateResult } from 'lit';
import { gridVisualUnits } from './grid-scale';
import type { RenderOpening } from './interaction-types';
import type { SpaceDisplay } from './logic';
import type { SpaceModel } from './types';
import { intersection, union, type Geom } from './wall-boolean-cache';
import { polyclipToPathD, recutWallBodiesGeometry, resolveOpeningWallAssociation, wallBodiesUnionPath, wallBodyNeedsSolid, wallHatchNeedsSolid, wallHatchStepUnits, } from './wall-thickness';
import { cutPartitionBody, geometryOuterRings, type PhysicalBodyParts, type PartitionOpeningCut } from './physical-geometry';
import { geometryOpenings, geometryPartitionOpeningCuts } from './plan-geometry-preflight';
import { NORM_W } from './space-geometry';
type WallUnion = NonNullable<ReturnType<typeof wallBodiesUnionPath>>;
type RecutBase = Parameters<typeof recutWallBodiesGeometry>[0];
type OpeningInput = {
    x: number;
    y: number;
    angle: number;
    length: number;
};
type Bounds = [
    number,
    number,
    number,
    number
];
const polygon = (points: number[][]): Geom => [[[...points.map(p => [p[0], p[1]] as [
            number,
            number
        ]), [points[0][0], points[0][1]]]]];
const box = ([x0, y0, x1, y1]: Bounds): Geom => polygon([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
const expanded = (b: Bounds, n: number): Bounds => [b[0] - n, b[1] - n, b[2] + n, b[3] + n];
const combine = (pieces: Geom[]): Geom => pieces.length > 1 ? union(pieces[0], ...pieces.slice(1)) : pieces[0] || [];
const cropBodies = (bodies: number[][][], region: Geom): Geom[] => bodies.flatMap(body => {
    const clipped = intersection(polygon(body), region);
    return clipped.length ? [clipped] : [];
});
/** Snap only presentation ownership, never the opening or masonry coordinates.
 * Complementary fractional masks double-composite the unchanged wall at their
 * boundary. Both clips share exact physical-pixel edges, so one owns each pixel.
 */
export interface OpeningDragViewport {
    a: number; b: number; c: number; d: number; e: number; f: number; dpr: number;
}
export function openingDragClip(bounds: readonly Bounds[], view: OpeningDragViewport): Geom | null {
    const { a, b, c, d, e, f, dpr } = view, det = a * d - b * c;
    if (![a, b, c, d, e, f, dpr, det].every(Number.isFinite) || !(dpr > 0) || Math.abs(det) < 1e-12)
        return null;
    // Houseplan's camera uses quarter turns. Unknown transforms retain the
    // explicit canonical fallback rather than clipping an unbounded diagonal.
    if (!(Math.abs(b) < 1e-8 && Math.abs(c) < 1e-8 || Math.abs(a) < 1e-8 && Math.abs(d) < 1e-8))
        return null;
    return combine(bounds.map(([x0, y0, x1, y1]) => {
        const points = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => [a*x+c*y+e, b*x+d*y+f]);
        const left = Math.floor(Math.min(...points.map(p => p[0])) * dpr) / dpr;
        const right = Math.ceil(Math.max(...points.map(p => p[0])) * dpr) / dpr;
        const top = Math.floor(Math.min(...points.map(p => p[1])) * dpr) / dpr;
        const bottom = Math.ceil(Math.max(...points.map(p => p[1])) * dpr) / dpr;
        return polygon([[left, top], [right, top], [right, bottom], [left, bottom]].map(([x, y]) =>
            [(d*(x-e)-c*(y-f))/det, (-b*(x-e)+a*(y-f))/det]));
    }));
}
/** Host identity selects a fixed patch, never one new floor key per position. */
export function openingDragHostBounds(space: SpaceModel, opening: RenderOpening, padding: number, tolerance: number): Bounds[] | null {
    const segments = opening.host?.kind === 'partition'
        ? space.partitions.filter(p => p.id === opening.host!.id).map(p => [p.a, p.b])
        : space.rooms.flatMap(room => (room.poly || []).map((a, i, poly) => [a, poly[(i + 1) % poly.length]]))
            .filter(([a, b]) => {
            const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
            if (!(length > 0))
                return false;
            const rad = opening.angle * Math.PI / 180;
            if (Math.abs(dx * Math.sin(rad) - dy * Math.cos(rad)) / length > 1e-5)
                return false;
            const along = ((opening.rx - a[0]) * dx + (opening.ry - a[1]) * dy) / (length * length);
            return along >= -tolerance / length && along <= 1 + tolerance / length
                && Math.abs((opening.rx - a[0]) * dy - (opening.ry - a[1]) * dx) / length <= tolerance;
        });
    if (!segments.length)
        return null;
    const seen = new Set<string>();
    return segments.flatMap(([a, b]) => {
        const bounds: Bounds = [Math.min(a[0], b[0]) - padding, Math.min(a[1], b[1]) - padding, Math.max(a[0], b[0]) + padding, Math.max(a[1], b[1]) + padding];
        const key = bounds.join(',');
        if (seen.has(key))
            return [];
        seen.add(key);
        return [bounds];
    });
}
export function renderOpeningDragGeometry(paths: readonly {
    d: string;
    id: string;
    fillRule: 'evenodd' | 'nonzero';
}[], depth: number, display: SpaceDisplay, cellCm: number, pixelsPerUnit: number): TemplateResult {
    const solid = wallBodyNeedsSolid(depth, pixelsPerUnit) || wallHatchNeedsSolid(wallHatchStepUnits(cellCm), pixelsPerUnit);
    const stroke = display.color || '#607d8b', fill = display.wallFill;
    return svg `<g class="wallbodies hp-opening-drag-local" style="--room-stroke:${stroke};--wall-fill:${fill.c};--wall-fill-op:${fill.a}">
    ${paths.map(component => svg `<path class="wallbody-fill" data-component=${component.id} d=${component.d}
      fill=${fill.c} fill-opacity=${fill.a} fill-rule=${component.fillRule} stroke="none" pointer-events="none"></path>
      <path class="wallbody ${solid ? 'solid' : ''}" data-hp="wall" data-id="opening-preview" data-kind="opening-preview"
        d=${component.d} fill=${solid ? 'none' : 'url(#hp-wall-hatch)'} fill-rule=${component.fillRule}
        stroke=${stroke} stroke-width=${gridVisualUnits(.6, cellCm)} pointer-events="none"></path>`)}
  </g>`;
}
export class OpeningDragWalls {
    private key = '';
    private clip: Geom = [];
    private outer: Geom = [];
    private room: RecutBase | null = null;
    private staticExtras: Geom[] = [];
    private target: number[][] | null = null;
    private patches: number[][][] = [];
    private readonly original: RenderOpening;
    private readonly partitionCuts: PartitionOpeningCut[];
    private readonly parts: PhysicalBodyParts | null;
    public constructor(private readonly base: WallUnion, private readonly space: SpaceModel, private readonly openings: readonly RenderOpening[], private readonly id: string, private readonly roomInputs: (openings: readonly RenderOpening[]) => OpeningInput[], private readonly extraBodies: readonly number[][][], private readonly cellCm: number, private readonly gridPitch: number, retainedParts: PhysicalBodyParts | null = null) {
        this.original = openings.find(o => o.id === id)!;
        const projected = geometryOpenings({ openings }, space, cellCm, gridPitch, NORM_W);
        this.partitionCuts = geometryPartitionOpeningCuts(projected, o => o.id !== id);
        this.parts = retainedParts;
    }
    private prepare(opening: RenderOpening, viewport: OpeningDragViewport): boolean {
        if (!this.original || opening.orphanReason)
            return false;
        if (opening.host?.kind !== 'partition') {
            if (!this.base.openingIndex)
                return false;
            const association = resolveOpeningWallAssociation(this.base.openingIndex, { x: opening.rx, y: opening.ry, angle: opening.angle, length: opening.rlen }, true);
            if (!association.negative && !association.positive)
                return false;
        }
        const padding = Math.max(this.base.openingPadUnits || this.base.depthUnits * 1.25, this.gridPitch);
        const before = openingDragHostBounds(this.space, this.original, padding, this.gridPitch * .04);
        const current = openingDragHostBounds(this.space, opening, padding, this.gridPitch * .04);
        if (!before || !current)
            return false;
        const bounds = [...before, ...current];
        const margin = gridVisualUnits(2, this.cellCm);
        const key = Object.values(viewport).join(',') + ':' + margin + ':' + bounds.map(b => b.join(',')).sort().join('|');
        if (key === this.key && this.room)
            return true;
        const clip = openingDragClip(bounds, viewport);
        if (!clip)
            return false;
        this.clip = clip;
        // The visible clip lies strictly inside this preparation clip. Its crop
        // boundary can never add an artificial wall stroke to the live scene.
        const outer = this.outer = combine(clip.map(poly => {
            const points = poly[0];
            const bounds: Bounds = [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])),
                Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))];
            return box(expanded(bounds, margin));
        }));
        const source = this.base.roomComponents?.length ? this.base.roomComponents : [{ id: 'room-primary', geom: this.base.roomGeom }];
        const roomComponents = source.flatMap(component => {
            const geom = intersection(component.geom, outer);
            return geom.length ? [{ id: component.id, geom }] : [];
        });
        const roomGeom = combine(roomComponents.map(component => component.geom));
        // Retained topology is intentionally non-enumerable on WallUnion. Copy
        // these fields explicitly; spreading the SVG projection drops the index.
        const retained: RecutBase = { status: this.base.status, roomGeom, roomComponents,
            openingIndex: this.base.openingIndex, openingPadUnits: this.base.openingPadUnits, depthUnits: this.base.depthUnits };
        const cutOthers = recutWallBodiesGeometry(retained, this.roomInputs(this.openings.filter(o => o.id !== this.id)), []);
        if (!cutOthers)
            return false;
        this.room = { ...retained, roomGeom: cutOthers.geom, roomComponents: cutOthers.components };
        let extras: number[][][] = [...this.extraBodies];
        this.target = null;
        this.patches = [];
        if (opening.host?.kind === 'partition') {
            if (!this.parts?.rawPatches)
                return false;
            const index = this.space.partitions.findIndex(p => p.id === opening.host!.id);
            if (index < 0 || !this.parts.partitions[index])
                return false;
            this.target = this.parts.partitions[index];
            // Only join volumes overlapping this host enter per-frame cutting.
            this.patches = cropBodies(this.parts.rawPatches.flatMap(body => cutPartitionBody(body, this.partitionCuts, this.gridPitch * .0002)), outer).flatMap(geom => geometryOuterRings(geom));
            extras = [...this.parts.columns, ...this.parts.partitions.flatMap((body, i) => i === index ? []
                    : cutPartitionBody(body, this.partitionCuts.filter(cut => cut.hostId === this.space.partitions[i].id), this.gridPitch * .0002))];
        }
        this.staticExtras = cropBodies(extras, outer);
        this.key = key;
        return true;
    }
    public render(opening: RenderOpening, settled: TemplateResult, display: SpaceDisplay, pixelsPerUnit: number, owner: string, viewport: OpeningDragViewport | null = null): TemplateResult | null {
        try {
            if (!viewport || !this.prepare(opening, viewport) || !this.room)
                return null;
            let extras = [...this.staticExtras];
            if (this.target) {
                const cuts = geometryPartitionOpeningCuts(geometryOpenings({ openings: [opening] }, this.space, this.cellCm, this.gridPitch, NORM_W));
                extras.push(...cropBodies(cutPartitionBody(this.target, [...this.partitionCuts.filter(c => c.hostId === opening.host!.id), ...cuts], this.gridPitch * .0002), this.outer));
                extras.push(...cropBodies(this.patches.flatMap(patch => cutPartitionBody(patch, cuts, this.gridPitch * .0002)), this.outer));
            }
            const recut = recutWallBodiesGeometry(this.room, this.roomInputs([opening]), []);
            if (!recut)
                return null;
            const geometry = combine([...recut.components.map(c => c.geom), ...extras]);
            const d = polyclipToPathD(geometry), clip = polyclipToPathD(this.clip);
            const clipId = 'hp-opening-drag-clip-' + owner, outsideId = 'hp-opening-drag-outside-' + owner;
            return svg `<g class="hp-opening-drag-walls"><defs>
        <clipPath id=${clipId}><path d=${clip}></path></clipPath>
        <clipPath id=${outsideId}><path d=${'M-1000000,-1000000H1000000V1000000H-1000000Z' + clip} clip-rule="evenodd"></path></clipPath></defs>
        <g clip-path=${`url(#${outsideId})`}>${settled}</g>
        <g clip-path=${`url(#${clipId})`}>${renderOpeningDragGeometry([{ id: 'local', d, fillRule: 'evenodd' }], this.base.depthUnits, display, this.cellCm, pixelsPerUnit)}</g>
      </g>`;
        }
        catch {
            return null;
        }
    }
}
