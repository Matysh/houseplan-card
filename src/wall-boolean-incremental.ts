/** Lazy Select-only reuse of an unchanged boolean boundary. No rounded keys,
 * historical candidate cache, or identity-only canonicality assumptions. */
import type { Geom } from 'polyclip-ts';
import type { WallBooleanOperation } from './wall-boolean-cache';
import { prepareWallBoundarySplice, type PreparedWallBoundarySplice } from './wall-boundary-splice';
import { wallIntersectionSignature } from './wall-intersection-signature';

type Multi = ReturnType<typeof import('polyclip-ts').union>;
type Baseline = { key: string; splice: PreparedWallBoundarySplice };
const copy = (value: Multi): Multi => value.map(polygon => polygon.map(ring =>
  ring.map(point => [point[0], point[1]] as [number, number])));
const LIMIT = 500_000;

export class WallBooleanIncremental {
  private readonly canonical = new Map<string, true>();
  private canonicalCharacters = 0;
  private readonly baselines = new Map<string, Baseline[]>();
  private readonly intersections = new Map<string, Multi>();
  private baselineCharacters = 0;
  readonly counts = { hits: 0, attempts: 0, known: 0, stored: 0, characters: 0 };

  /** Successful canonical geometry is certified by its COMPLETE value, including
   * polygon/hole ownership. Mutating a previously returned array cannot preserve
   * this certificate. An exact deep clone of a known value is safe to recognize.
   * The bounded FIFO holds certificates only; candidates never enter the frozen
   * result table. A successfully proved splice also supplies a certificate. */
  remember(result: Multi): void {
    const key = JSON.stringify(result);
    if (key.includes('null') || key.length > LIMIT || this.canonical.has(key)) return;
    while (this.canonical.size >= 256 || this.canonicalCharacters + key.length > LIMIT) {
      const oldest = this.canonical.keys().next().value!;
      this.canonical.delete(oldest); this.canonicalCharacters -= oldest.length;
    }
    this.canonical.set(key, true); this.canonicalCharacters += key.length;
    this.updateCounts();
  }

  private candidate(operation: WallBooleanOperation, operands: Geom[]): { key: string; group: string } | null {
    if ((operation !== 'union' && operation !== 'difference') || operands.length < 2) return null;
    const key = JSON.stringify(operands[0]);
    if (!this.canonical.has(key)) return null;
    const rest = JSON.stringify(operands.slice(1));
    if (rest.includes('null')) return null;
    return { key, group: `${operation}:${rest}` };
  }

  private intersectionKey(operation: WallBooleanOperation, operands: Geom[]): string | null {
    if (operation !== 'intersection' || operands.length !== 2 ||
        !this.canonical.has(JSON.stringify(operands[1]))) return null;
    return wallIntersectionSignature(operands[0], operands[1]);
  }

  /** Only the original frozen geometry pass may record a baseline. A new
   * pointer position can neither replace it nor grow this bounded table. */
  record(operation: WallBooleanOperation, operands: Geom[], result: Multi): void {
    const intersection = this.intersectionKey(operation, operands);
    if (intersection !== null) {
      const characters = intersection.length + JSON.stringify(result).length;
      if (!this.intersections.has(intersection) && this.counts.stored < 256 &&
          this.baselineCharacters + characters <= LIMIT) {
        this.intersections.set(intersection, copy(result));
        this.baselineCharacters += characters; this.counts.stored++;
        this.updateCounts();
      }
      return;
    }
    const candidate = this.candidate(operation, operands);
    if (!candidate) return;
    const previous = this.baselines.get(candidate.group);
    if ((previous?.length || 0) >= 4 || this.counts.stored >= 256) return;
    const characters = candidate.key.length + candidate.group.length + JSON.stringify(result).length;
    if (this.baselineCharacters + characters > LIMIT) return;
    const splice = prepareWallBoundarySplice(operands[0], operands.slice(1), result);
    if (!splice) return;
    const baseline = { key: candidate.key, splice };
    if (previous) previous.push(baseline);
    else this.baselines.set(candidate.group, [baseline]);
    this.baselineCharacters += characters; this.counts.stored++;
    this.updateCounts();
  }

  reuse(operation: WallBooleanOperation, operands: Geom[]): Multi | null {
    const intersection = this.intersectionKey(operation, operands);
    if (intersection !== null) {
      this.counts.attempts++;
      const result = this.intersections.get(intersection);
      if (result) { this.counts.hits++; return copy(result); }
      return null;
    }
    const candidate = this.candidate(operation, operands);
    if (!candidate) return null;
    for (const baseline of this.baselines.get(candidate.group) || []) {
      // The ordinary full-key cache owns the unchanged-input case.
      if (baseline.key === candidate.key) continue;
      this.counts.attempts++;
      try {
        const result = baseline.splice(operands[0]);
        if (result) { this.counts.hits++; return result; }
      } catch {
        // An unprovable/failed shortcut is NOT a boolean verdict. The caller
        // must execute the original operation, including its original failure.
      }
    }
    return null;
  }

  private updateCounts(): void {
    this.counts.known = this.canonical.size;
    this.counts.characters = this.canonicalCharacters + this.baselineCharacters;
  }
}
