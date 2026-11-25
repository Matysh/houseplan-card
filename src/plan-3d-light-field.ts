import { CanvasTexture, Color, DataTexture, FloatType, MeshBasicMaterial, NearestFilter, RGBAFormat,
  type MeshBasicMaterialParameters } from 'three';
import { GLOW_FALLOFF } from './glow-scene';
import type { PlanPoint } from './iso-projection';

export interface PlanLightFieldSource {
  key: string;
  color: string;
  alpha: number;
  radius: number;
  /** One point for a lamp; a continuous polyline for an LED strip. */
  points: readonly (readonly number[])[];
  visible: readonly string[];
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
  rule?: CanvasFillRule;
  floorClip?: readonly string[] | null;
  sun?: { inward: PlanPoint; depth: number; tilt: number };
}

const TILE = 128;
const PAD = 2;
const STRIDE = 1024;
type MaskBounds = readonly [number, number, number, number];
const sourceBounds = (source: Plan3dLight): MaskBounds => {
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
  for (const path of source.visible) {
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
    vec2 position = vHpWorld.xz;
    vec2 probe = position + N.xz * uHpNormalOffset;
    vec3 remaining = vec3(1.0);
    vec3 reflected = vec3(1.0);
    for (int i = 0; i < uHpLightCount; i++) {
      vec4 bounds = hpData(i * 4);
      vec2 uv = (probe - bounds.xy) / bounds.zw;
      if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) continue;
      vec2 tile = vec2(mod(float(i), uHpTileCount), floor(float(i) / uHpTileCount));
      vec2 maskUv = (tile + (${PAD}.0 + uv * ${TILE - PAD * 2}.0) / ${TILE}.0) / uHpTileCount;
      float visible = texture2D(uHpMasks, maskUv).a;
      if (visible < 0.001) continue;
      vec4 optical = hpData(i * 4 + 1);
      vec4 pigment = hpData(i * 4 + 2);
      vec4 sun = hpData(i * 4 + 3);
      int start = int(optical.z);
      int count = int(optical.w);
      vec2 next = hpData(start).xy;
      if (sun.z > 0.0) {
        vec2 p = probe - next;
        float travel = dot(sun.xy, p);
        if (travel < 0.0 || travel >= sun.z || vHpWorld.y > max(0.0, optical.y - travel * sun.w)) continue;
        vec3 towardWindow = vec3(-sun.x, max(0.001, sun.w), -sun.y);
        float incidence = vHpWorld.y == 0.0 && N.y > .999 ? 1.0 : max(dot(N, normalize(towardWindow)), .18);
        float fading = hpFalloff(travel / sun.z);
        float energy = clamp(pigment.a * visible * fading * incidence, 0.0, 1.0);
        remaining *= 1.0 - pigment.rgb * energy;
        reflected *= 1.0 - (1.0 - pigment.rgb) * energy * .32;
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
      float fall = hpFalloff(sqrt(distance2) / optical.x);
      vec3 delta = vec3(closest.x, optical.y, closest.y) - vHpWorld;
      float angle = max(dot(N, delta) / max(length(delta), 0.0001), 0.0);
      // Preserve the calibrated floor envelope. World normals and emitter
      // height distribute that light on the upright faces and raised objects.
      float incidence = vHpWorld.y == 0.0 && N.y > 0.999 ? 1.0 : angle;
      float energy = clamp(pigment.a * visible * fall * incidence, 0.0, 1.0);
      remaining *= 1.0 - pigment.rgb * energy;
      reflected *= 1.0 - (1.0 - pigment.rgb) * energy * .32;
    }
    float ambient = mix(1.0, .88 + .11 * max(0.0, dot(N, normalize(vec3(-.8, .65, .6)))),
      uHpSideShade * (1.0 - abs(N.y)));
    return (1.0 - (1.0 - base * ambient) * remaining) * mix(vec3(1.0), reflected, base);
  }
`;

/** Position/visibility textures are world data. Moving the camera never
 * touches them. Color-only changes leave the cached aperture mask alone. */
export class Plan3dLightField {
  private readonly atlas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly floorContext: CanvasRenderingContext2D;
  private masks: CanvasTexture;
  private texture: DataTexture | undefined;
  private maskKey: string | undefined;
  private bounds: MaskBounds[] = [];
  private opticalKey: string | undefined;
  private readonly uniforms;

  constructor(document: Document, normalOffset: number) {
    this.atlas = document.createElement('canvas');
    const context = this.atlas.getContext('2d');
    const floorTile = document.createElement('canvas');
    floorTile.width = floorTile.height = TILE;
    const floorContext = floorTile.getContext('2d');
    if (!context || !floorContext) throw new Error('Unable to prepare the plan light mask');
    this.context = context;
    this.floorContext = floorContext;
    this.masks = this.maskTexture();
    this.uniforms = {
      uHpMasks: { value: this.masks },
      uHpLights: { value: null as DataTexture | null },
      uHpLightCount: { value: 0 },
      uHpTileCount: { value: 1 },
      uHpNormalOffset: { value: normalOffset },
    };
  }

  private maskTexture(): CanvasTexture {
    const texture = new CanvasTexture(this.atlas);
    texture.flipY = false;
    texture.generateMipmaps = false;
    return texture;
  }

  set(sources: readonly Plan3dLight[]): void {
    const usable = sources.filter(source => source.radius > 0 && source.points.length && source.visible.length);
    const maskKey = JSON.stringify(usable.map(({ points, radius, visible, rule, floorClip }) =>
      [points, radius, visible, rule, floorClip]));
    const opticalKey = JSON.stringify(usable.map(({ color, height, intensity, sun }) => [color, height, intensity, sun]));
    const sameMask = maskKey === this.maskKey;
    if (sameMask && opticalKey === this.opticalKey) return;

    if (!sameMask) this.bounds = usable.map(sourceBounds);
    const bounds = this.bounds;
    const dim = Math.max(1, Math.ceil(Math.sqrt(usable.length)));
    if (!sameMask) {
      const edge = dim * TILE;
      if (this.atlas.width !== edge || this.atlas.height !== edge) {
        this.atlas.width = this.atlas.height = edge;
        // WebGL's immutable texture allocation must match the new canvas size.
        this.masks.dispose();
        this.masks = this.maskTexture();
        this.uniforms.uHpMasks.value = this.masks;
      } else this.context.clearRect(0, 0, edge, edge);
      for (const [index, source] of usable.entries()) {
        const [x, y, w, h] = bounds[index];
        const ctx = this.context;
        const left = index % dim * TILE + PAD, top = Math.floor(index / dim) * TILE + PAD;
        const span = TILE - 2 * PAD;
        ctx.save();
        ctx.beginPath(); ctx.rect(left, top, span, span); ctx.clip();
        ctx.translate(left, top); ctx.scale(span / w, span / h); ctx.translate(-x, -y);
        ctx.fillStyle = '#fff';
        for (const path of source.visible) ctx.fill(new Path2D(path), source.rule ?? 'evenodd');
        if (source.floorClip) {
          // Each entry may contain holes. Different entries are a union,
          // as in the flat SVG clip. Combining them in one even-odd path
          // would cancel the overlapping floor and the door's threshold.
          const floor = this.floorContext;
          floor.resetTransform(); floor.clearRect(0, 0, TILE, TILE);
          floor.translate(PAD, PAD); floor.scale(span / w, span / h); floor.translate(-x, -y);
          floor.fillStyle = '#fff';
          for (const path of source.floorClip) floor.fill(new Path2D(path), 'evenodd');
          ctx.resetTransform(); ctx.globalCompositeOperation = 'destination-in';
          ctx.drawImage(floor.canvas, left - PAD, top - PAD);
        }
        ctx.restore();
      }
      this.masks.needsUpdate = true;
    }

    const values: number[] = [], points: number[] = [];
    for (const [index, source] of usable.entries()) {
      const color = new Color(source.color);
      const sun = source.sun;
      values.push(...bounds[index], source.radius, source.height, usable.length * 4 + points.length / 4,
        source.points.length, color.r, color.g, color.b, source.intensity,
        sun?.inward[0] ?? 0, sun?.inward[1] ?? 0, sun?.depth ?? 0, sun?.tilt ?? 0);
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
    this.texture?.dispose();
    this.atlas.width = this.atlas.height = 0;
  }
}
