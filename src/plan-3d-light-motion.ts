import { Color } from 'three';
import type { Plan3dLight } from './plan-3d-light-field';
import { RAY_FADE_MS } from './sun';

const LAMP_FADE_MS = 500;
type Blend = { from: Plan3dLight; to: Plan3dLight; start: number; duration: number; retire: boolean };

/** Retarget each emitter independently. Geometry/authority changes replace
 * its optical source while state-only changes fade on the same surface. */
export class Plan3dLightMotion {
  private readonly stable = new Map<string, Plan3dLight>();
  private readonly blends = new Map<string, Blend>();
  private scope = '';

  set(sources: readonly Plan3dLight[], scope: string, time: number, motion: boolean): void {
    if (this.scope !== scope || !motion) {
      this.reset(sources, scope);
      return;
    }
    const target = keyed(sources);
    const ids = new Set([...this.stable.keys(), ...this.blends.keys(), ...target.keys()]);
    for (const id of ids) {
      const current = this.blends.get(id), stable = this.stable.get(id), next = target.get(id);
      const planned = current?.to ?? stable;
      if (!next && planned?.sun) {
        this.blends.delete(id);
        this.stable.delete(id);
        continue;
      }
      if (!next && (!planned || current?.retire)) continue;
      // At the horizon the requested beam can move as well as fade. Keep the
      // last lit footprint throughout fade-out, then adopt the new footprint
      // on fade-in without resetting the intensity of an interrupted fade.
      const to = !next || next.sun && next.intensity === 0 && planned
        ? { ...planned!, intensity: 0 } : next;
      if (next && planned && planned.color === to.color && planned.intensity === to.intensity
        && geometry(planned) === geometry(to) && !current?.retire) continue;
      let from = current ? sample(current, time) : stable ?? { ...to, intensity: 0 };
      if (to.sun && to.intensity > 0 && planned?.intensity === 0) from = { ...to, intensity: from.intensity };
      this.stable.delete(id);
      if (geometry(from) === geometry(to)) {
        this.blends.set(id, { from, to, start: time, duration: to.sun ? RAY_FADE_MS : LAMP_FADE_MS, retire: !next });
      } else {
        this.blends.delete(id);
        if (next) this.stable.set(id, next);
      }
    }
  }

  frame(time: number): { sources: readonly Plan3dLight[]; active: boolean } {
    const mixing: [string, Plan3dLight][] = [];
    for (const [id, blend] of this.blends) {
      if (time < blend.start + blend.duration) {
        mixing.push([id, sample(blend, time)]);
      } else {
        this.blends.delete(id);
        if (!blend.retire) this.stable.set(id, blend.to);
      }
    }
    const sources = [...this.stable.entries(), ...mixing].sort(([left], [right]) => left.localeCompare(right));
    return { sources: sources.map(([, source]) => source), active: this.blends.size > 0 };
  }

  private reset(sources: readonly Plan3dLight[], scope: string): void {
    this.scope = scope;
    this.blends.clear();
    this.stable.clear();
    for (const [id, source] of keyed(sources)) this.stable.set(id, source);
  }
}

const keyed = (sources: readonly Plan3dLight[]) => new Map(sources.map((source, i) => [source.id ?? String(i), source]));
const geometry = ({ points, height, radius, visible, rule, floorClip, sun }: Plan3dLight) =>
  JSON.stringify([points, height, radius, visible, rule, floorClip, sun]);

function sample({ from, to, start, duration }: Blend, time: number): Plan3dLight {
  const t = Math.min(1, Math.max(0, (time - start) / duration));
  const color = from.color === to.color ? to.color : '#' + new Color(from.color).lerp(new Color(to.color), t).getHexString();
  return { ...to, color, intensity: from.intensity + t * (to.intensity - from.intensity) };
}
