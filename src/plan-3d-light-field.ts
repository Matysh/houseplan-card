import { CanvasTexture, Color, DataTexture, FloatType, LinearFilter, MeshBasicMaterial, NearestFilter, RGBAFormat, RGFormat,
  type MeshBasicMaterialParameters } from 'three';
import { GLOW_FALLOFF } from './glow-scene';
import type { PlanPoint } from './iso-projection';
import { packFloorMask } from './plan-3d-floor-mask';

export interface PlanLightFieldSource {
  key: string;
  color: string;
  alpha: number;
  radius: number;
  /** One point for a lamp; a continuous polyline for an LED strip. */
  points: readonly (readonly number[])[];
  visible: readonly string[];
  /** Bare transport. LED fan paths already represent transport. */
  wallVisible?: readonly string[];
  rule?: CanvasFillRule;
  floorClip?: readonly string[] | null;
  entering: boolean;
  leaving: boolean;
}

export interface Plan3dLight {
  id?: string;
  /** Single positioned lamp or an LED polyline in plan coordinates. */
  points: readonly PlanPoint[];
  height: number;
  radius: number;
  color: string;
  intensity: number;
  visible: readonly string[];
  wallVisible?: readonly string[];
  wallClip?: readonly string[] | null;
  ribbon?: boolean;
  rule?: CanvasFillRule;
  floorClip?: readonly string[] | null;
  sun?: { inward: PlanPoint; depth: number; tilt: number };
}

const TILE = 128;
const PAD = 2;
const STRIDE = 1024;
type MaskBounds = readonly [number, number, number, number];
const sourceBounds = (source: Plan3dLight, visibility = source.visible): MaskBounds => {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of source.points) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const r = source.radius;
  const radial: MaskBounds = [minX - r, minY - r, maxX - minX + 2 * r, maxY - minY + 2 * r];
  // The visibility solver emits closed polygons. Bound the mask by the
  // illuminated geometry so a user radius larger than the house does not
  // turn a door's shadow edge into a room-wide texture texel.
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const path of visibility) {
    if (/[A-DF-KN-Y]|[a-df-z]/.test(path)) return radial;
    const xy = path.match(/[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/gi)?.map(Number) ?? [];
    if (xy.length < 6 || xy.length % 2 !== 0 || !xy.every(Number.isFinite)) return radial;
    for (let i = 0; i < xy.length; i += 2) {
      left = Math.min(left, xy[i]); top = Math.min(top, xy[i+1]);
      right = Math.max(right, xy[i]); bottom = Math.max(bottom, xy[i+1]);
    }
  }
  left = Math.max(left, radial[0]); top = Math.max(top, radial[1]);
  right = Math.min(right, radial[0] + radial[2]); bottom = Math.min(bottom, radial[1] + radial[3]);
  return right > left && bottom > top ? [left, top, right - left, bottom - top] : radial;
};

function dataTexture(values: number[], previous?: DataTexture): DataTexture {
  const row = Math.max(1, Math.ceil(values.length / (STRIDE * 4)));
  const data = previous?.image.height === row ? previous.image.data as Float32Array : new Float32Array(row * STRIDE * 4);
  data.set(values);
  const texture = data === previous?.image.data ? previous : new DataTexture(data, STRIDE, row, RGBAFormat, FloatType);
  texture.minFilter = texture.magFilter = NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

const falloff = GLOW_FALLOFF.slice(1).map(([right, value], index) => {
  const [left, previous] = GLOW_FALLOFF[index];
  return `if (r <= ${(right / 100).toFixed(4)}) return mix(${previous.toFixed(4)}, ${value.toFixed(4)}, (r - ${(left / 100).toFixed(4)}) / ${((right - left) / 100).toFixed(4)});`;
}).join('\n');

const LIGHT_GLSL = `
  varying vec3 vHpWorld;
  varying vec3 vHpNormal;
  uniform sampler2D uHpMasks;
  uniform sampler2D uHpWallMasks;
  uniform sampler2D uHpLights;
  uniform int uHpLightCount;
  uniform float uHpTileCount;
  uniform float uHpNormalOffset;
  uniform float uHpSideShade;
  vec4 hpData(int index) {
    return texelFetch(uHpLights, ivec2(index % ${STRIDE}, index / ${STRIDE}), 0);
  }
  float hpFalloff(float r) {
    ${falloff}
    return 0.0;
  }
  vec3 hpLit(vec3 base) {
    vec3 N = normalize(vHpNormal) * (gl_FrontFacing ? 1.0 : -1.0);
    bool floorReceiver = vHpWorld.y == 0.0 && N.y > .999;
    vec2 position = vHpWorld.xz;
    vec2 probe = position + N.xz * uHpNormalOffset;
    vec3 remaining = vec3(1.0);
    vec3 reflected = vec3(1.0);
    for (int i = 0; i < uHpLightCount; i++) {
      int index = i * 5;
      vec4 sun = hpData(index + 3);
      bool wall = sun.z <= 0.0 && abs(N.y) < .01;
      vec4 bounds = hpData(index + (wall ? 4 : 0));
      vec2 samplePoint = probe;
      if (wall) {
        // A wall lies on the solved boundary. Sample a fractional texel on
        // its receiving side, bounded in plan units even for huge masks.
        float texel = 1.0 / max(length(N.xz / bounds.zw) * ${TILE - PAD * 2}.0, .0001);
        float inward = max(uHpNormalOffset, min(.84 * texel, max(.8, uHpNormalOffset * 48.0)));
        samplePoint = position + N.xz * inward;
      }
      vec2 uv = (samplePoint - bounds.xy) / bounds.zw;
      if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) continue;
      vec2 tile = vec2(mod(float(i), uHpTileCount), floor(float(i) / uHpTileCount));
      vec2 maskUv = (tile + (${PAD}.0 + uv * ${TILE - PAD * 2}.0) / ${TILE}.0) / uHpTileCount;
      float visible;
      if (wall) visible = texture2D(uHpWallMasks, maskUv).a;
      else {
        vec2 floorMask = texture2D(uHpMasks, maskUv).rg;
        // Distance provides a continuous sub-texel contour, with the same
        // world-space softness at every zoom. Sunlight and raised receivers
        // keep their original coverage from the same packed sample.
        visible = sun.z <= 0.0 && floorReceiver
          ? smoothstep(.25, .75, floorMask.r) : floorMask.g;
      }
      if (visible < 0.001) continue;
      vec4 optical = hpData(index + 1);
      vec4 pigment = hpData(index + 2);
      int start = int(optical.z);
      int count = int(optical.w);
      vec2 next = hpData(start).xy;
      if (sun.z > 0.0) {
        vec2 p = probe - next;
        float travel = dot(sun.xy, p);
        if (travel < 0.0 || travel >= sun.z || vHpWorld.y > max(0.0, optical.y - travel * sun.w)) continue;
        vec3 towardWindow = vec3(-sun.x, max(0.001, sun.w), -sun.y);
        float incidence = floorReceiver ? 1.0 : max(dot(N, normalize(towardWindow)), .18);
        float fading = hpFalloff(travel / sun.z);
        float energy = clamp(1.22 * pigment.a * visible * fading * incidence, 0.0, 1.0);
        remaining *= 1.0 - pigment.rgb * energy;
        reflected *= 1.0 - (1.0 - pigment.rgb) * energy * .52;
        continue;
      }
      vec2 closest = next;
      float distance2 = dot(next - position, next - position);
      for (int segment = 1; segment < count; segment++) {
        vec2 a = next;
        next = hpData(start + segment).xy;
        vec2 ab = next - a;
        float t = clamp(dot(position - a, ab) / max(dot(ab, ab), 0.000001), 0.0, 1.0);
        vec2 point = a + t * ab;
        float dd = dot(point - position, point - position);
        if (dd < distance2) { distance2 = dd; closest = point; }
      }
      vec3 delta = vec3(closest.x, optical.y, closest.y) - vHpWorld;
      float angle = max(dot(N, delta) / max(length(delta), 0.0001), 0.0);
      bool ribbon = sun.w < 0.0;
      float fall = hpFalloff((wall && ribbon ? length(delta) : sqrt(distance2)) / optical.x);
      if (wall) {
        float facing = dot(N.xz, delta.xz);
        if (facing < (ribbon ? -uHpNormalOffset : .00001)) continue;
        // The linear near-surface emitter can touch the wall exactly. The
        // visibility fan resolves its receiving side; preserve a local wash
        // at the base instead of applying a zero projected cosine.
        angle = max(angle, ribbon ? .48 : .24);
      }
      // Preserve the calibrated floor envelope. World normals and emitter
      // height distribute that light on the upright faces and raised objects.
      float incidence = floorReceiver ? 1.0 : angle;
      float energy = clamp(1.20 * pigment.a * visible * fall * incidence, 0.0, 1.0);
      remaining *= 1.0 - pigment.rgb * energy;
      reflected *= 1.0 - (1.0 - pigment.rgb) * energy * .48;
    }
    // Architectural ambient describes orientation, not a synthetic emitter.
    // Keep it anchored in plan space so rotating the view doesn't recolor a wall.
    float ambient = mix(1.0, .78 + .21 * max(0.0, dot(N, normalize(vec3(-.9, .24, .55)))),
      uHpSideShade * (1.0 - abs(N.y)));
    return (1.0 - (1.0 - base * ambient) * remaining) * mix(vec3(1.0), reflected, base);
  }
`;

/** Position/visibility textures are world data. Moving the camera never
 * touches them. Color-only changes leave the cached aperture mask alone. */
export class Plan3dLightField {
  private readonly floorMaskContext: CanvasRenderingContext2D;
  private readonly wallContext: CanvasRenderingContext2D;
  private readonly floorContext: CanvasRenderingContext2D;
  private readonly floorDistances = new Float32Array(TILE * TILE);
  private masks: DataTexture;
  private wallMasks: CanvasTexture;
  private texture: DataTexture | undefined;
  private maskKey: string | undefined;
  private bounds: MaskBounds[] = [];
  private wallBounds: MaskBounds[] = [];
  private opticalKey: string | undefined;
  private readonly uniforms;

  constructor(document: Document, normalOffset: number) {
    const floorMask = document.createElement('canvas');
    floorMask.width = floorMask.height = TILE;
    const context = floorMask.getContext('2d', { willReadFrequently: true });
    const wallContext = document.createElement('canvas').getContext('2d');
    const floorTile = document.createElement('canvas');
    floorTile.width = floorTile.height = TILE;
    const floorContext = floorTile.getContext('2d');
    if (!context || !wallContext || !floorContext) throw new Error('Unable to prepare the plan light mask');
    this.floorMaskContext = context;
    this.wallContext = wallContext;
    this.floorContext = floorContext;
    this.masks = this.floorMaskTexture(TILE);
    this.wallMasks = this.maskTexture(wallContext.canvas);
    this.uniforms = {
      uHpMasks: { value: this.masks },
      uHpWallMasks: { value: this.wallMasks },
      uHpLights: { value: null as DataTexture | null },
      uHpLightCount: { value: 0 },
      uHpTileCount: { value: 1 },
      uHpNormalOffset: { value: normalOffset },
    };
  }

  private floorMaskTexture(size: number): DataTexture {
    // RG8: signed distance plus the original coverage, at half the texture
    // size of the previous RGBA canvas atlas and with the same tile count.
    const texture = new DataTexture(new Uint8Array(size * size * 2), size, size, RGFormat);
    texture.minFilter = texture.magFilter = LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }

  private maskTexture(canvas: HTMLCanvasElement): CanvasTexture {
    const texture = new CanvasTexture(canvas);
    texture.flipY = false;
    texture.generateMipmaps = false;
    return texture;
  }

  private drawMask(ctx: CanvasRenderingContext2D, paths: readonly string[], rule: CanvasFillRule,
    clip: readonly string[] | null | undefined, [x, y, w, h]: MaskBounds, column: number, row: number): void {
    const left = column * TILE + PAD, top = row * TILE + PAD;
    const span = TILE - 2 * PAD;
    ctx.save();
    ctx.beginPath(); ctx.rect(left, top, span, span); ctx.clip();
    ctx.translate(left, top); ctx.scale(span / w, span / h); ctx.translate(-x, -y);
    ctx.fillStyle = '#fff';
    for (const path of paths) ctx.fill(new Path2D(path), rule);
    if (clip) {
      // Entries union; holes within each room are respected.
      const floor = this.floorContext;
      floor.resetTransform(); floor.clearRect(0, 0, TILE, TILE);
      floor.translate(PAD, PAD); floor.scale(span / w, span / h); floor.translate(-x, -y);
      floor.fillStyle = '#fff';
      for (const path of clip) floor.fill(new Path2D(path), 'evenodd');
      ctx.resetTransform(); ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(floor.canvas, left - PAD, top - PAD);
    }
    ctx.restore();
  }

  set(sources: readonly Plan3dLight[]): void {
    const usable = sources.filter(source => source.radius > 0 && source.points.length && (source.visible.length || source.wallVisible?.length));
    const maskKey = JSON.stringify(usable.map(({ points, radius, visible, rule, floorClip, wallVisible, wallClip }) =>
      [points, radius, visible, rule, floorClip, wallVisible, wallClip]));
    const opticalKey = JSON.stringify(usable.map(({ color, height, intensity, sun, ribbon }) => [color, height, intensity, sun, ribbon]));
    const sameMask = maskKey === this.maskKey;
    if (sameMask && opticalKey === this.opticalKey) return;

    if (!sameMask) {
      this.bounds = usable.map(source => sourceBounds(source));
      this.wallBounds = usable.map(source => sourceBounds(source, source.wallVisible ?? source.visible));
    }
    const bounds = this.bounds;
    const dim = Math.max(1, Math.ceil(Math.sqrt(usable.length)));
    if (!sameMask) {
      const edge = dim * TILE;
      if (this.masks.image.width !== edge) {
        // WebGL's immutable texture allocation must match the new atlas size.
        this.masks.dispose();
        this.masks = this.floorMaskTexture(edge);
        this.uniforms.uHpMasks.value = this.masks;
      }
      if (this.wallContext.canvas.width !== edge || this.wallContext.canvas.height !== edge) {
        const wallCanvas = this.wallContext.canvas;
        wallCanvas.width = wallCanvas.height = edge;
        this.wallMasks.dispose();
        this.wallMasks = this.maskTexture(wallCanvas);
        this.uniforms.uHpWallMasks.value = this.wallMasks;
      } else {
        this.wallContext.clearRect(0, 0, edge, edge);
      }
      const context = this.floorMaskContext, pixels = this.masks.image.data as Uint8Array;
      for (const [index, source] of usable.entries()) {
        const column = index % dim, row = Math.floor(index / dim), rule = source.rule ?? 'evenodd';
        context.clearRect(0, 0, TILE, TILE);
        this.drawMask(context, source.visible, rule, source.floorClip, bounds[index], 0, 0);
        packFloorMask(context.getImageData(0, 0, TILE, TILE).data, TILE, pixels, edge, column, row,
          source.sun ? null : this.floorDistances);
        if (!source.sun) this.drawMask(this.wallContext, source.wallVisible ?? source.visible, rule,
          source.wallClip, this.wallBounds[index], column, row);
      }
      this.masks.needsUpdate = true;
      this.wallMasks.needsUpdate = true;
    }

    const values: number[] = [], points: number[] = [];
    for (const [index, source] of usable.entries()) {
      const color = new Color(source.color);
      const sun = source.sun;
      values.push(...bounds[index], source.radius, source.height, usable.length * 5 + points.length / 4,
        source.points.length, color.r, color.g, color.b, source.intensity,
        sun?.inward[0] ?? 0, sun?.inward[1] ?? 0, sun?.depth ?? 0, sun?.tilt ?? (source.ribbon ? -1 : 0),
        ...this.wallBounds[index]);
      for (const [x, y] of source.points) points.push(x, y, 0, 0);
    }
    const texture = dataTexture(values.concat(points), this.texture);
    if (texture !== this.texture) this.texture?.dispose();
    this.texture = texture;
    this.uniforms.uHpLights.value = texture;
    this.uniforms.uHpLightCount.value = usable.length;
    this.uniforms.uHpTileCount.value = dim;
    this.maskKey = maskKey;
    this.opticalKey = opticalKey;
  }

  material(params: MeshBasicMaterialParameters, shadeSides = false): MeshBasicMaterial {
    const material = new MeshBasicMaterial({ ...params, toneMapped: false });
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.uniforms.uHpSideShade = { value: shadeSides ? 1 : 0 };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vHpWorld;\nvarying vec3 vHpNormal;')
        .replace('#include <project_vertex>', `#include <project_vertex>
          vHpWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vHpNormal = mat3(modelMatrix) * normal;`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\n' + LIGHT_GLSL)
        .replace('#include <opaque_fragment>', 'outgoingLight = hpLit(outgoingLight);\n#include <opaque_fragment>');
    };
    material.customProgramCacheKey = () => 'houseplan-world-light';
    return material;
  }

  dispose(): void {
    this.masks.dispose();
    this.wallMasks.dispose();
    this.texture?.dispose();
    this.floorMaskContext.canvas.width = this.floorMaskContext.canvas.height = 0;
    this.wallContext.canvas.width = this.wallContext.canvas.height = 0;
  }
}
