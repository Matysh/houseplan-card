import { jsonValueEqual } from './json-value-equal';

/**
 * One wall-record preservation invariant for product transactions and the
 * offline model audit (#264).
 *
 * The broad audit answers whether a physical thickness class disappeared
 * completely; an exact fixed-topology transaction additionally proves the
 * whole `cm` multiset, including meaningful zero-thickness walls (#306).
 * Current graph Resize proves every source and target material by identity:
 * exact incident noding can split one stored record into several children.
 */

export interface WallRecordLike {
  cm?: unknown;
}

interface GraphMaterialRecord extends WallRecordLike {
  kind: string;
  id: string;
  props?: unknown;
}

/** Exact source identities, including one-to-many incident cuts and aliases. */
export interface GraphWallRecordProof {
  before: readonly GraphMaterialRecord[];
  after: readonly GraphMaterialRecord[];
  descendants: Readonly<Record<string, readonly string[]>>;
}

/** Graph noding may change atom counts, but may never lose a source material. */
export function graphWallRecordsPreserved(proof: GraphWallRecordProof): boolean {
  const key = (edge: GraphMaterialRecord) => edge.kind + ':' + edge.id;
  const after = new Map(proof.after.map(edge => [key(edge), edge]));
  if (after.size !== proof.after.length) return false;
  const covered = new Set<string>();
  for (const source of proof.before) {
    const children = proof.descendants[key(source)];
    if (!children?.length) return false;
    for (const child of children) {
      const target = after.get(child);
      if (!target || target.kind !== source.kind || target.cm !== source.cm
          || !jsonValueEqual(source.props || null, target.props || null)) return false;
      covered.add(child);
    }
  }
  return covered.size === after.size;
}

export interface WallRecordPreservationOptions {
  /** Explicit destructive thickness tools may opt out. Resize never does. */
  allowClear?: boolean;
  /** Fixed-topology operations preserve every record and its multiplicity. */
  exactMultiplicity?: boolean;
}

export interface WallRecordViolation {
  invariant: 'wall_records';
  kind: 'lost' | 'count';
  owner: string;
  reference: string;
  detail: string;
}

const finiteCm = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const counts = (
  walls: readonly WallRecordLike[] | null | undefined,
  includeEveryFiniteValue: boolean,
): Map<number, number> => {
  const out = new Map<number, number>();
  for (const wall of walls || []) {
    if (!finiteCm(wall?.cm) || (!includeEveryFiniteValue && wall.cm <= 0)) continue;
    out.set(wall.cm, (out.get(wall.cm) || 0) + 1);
  }
  return out;
};

const label = (cm: number): string => [String(cm), 'см'].join(' ');

/**
 * Return an empty list only when the requested preservation contract holds.
 * Structured violations are deliberately bounded: no coordinates, ids or
 * exception strings may reach UI or CI logs through this helper.
 */
export function checkWallRecordsPreserved(
  before: readonly WallRecordLike[] | null | undefined,
  after: readonly WallRecordLike[] | null | undefined,
  options: WallRecordPreservationOptions = {},
): WallRecordViolation[] {
  if (options.allowClear) return [];
  const exact = options.exactMultiplicity === true;
  const from = counts(before, exact);
  const to = counts(after, exact);
  const violations: WallRecordViolation[] = [];

  for (const [cm, was] of from) {
    const now = to.get(cm) || 0;
    if (now === 0) {
      violations.push({
        invariant: 'wall_records', kind: 'lost', owner: label(cm),
        reference: `было ${was}`, detail: 'записи этой толщины исчезли целиком',
      });
    } else if (exact && now !== was) {
      violations.push({
        invariant: 'wall_records', kind: 'count', owner: label(cm),
        reference: `было ${was}, стало ${now}`,
        detail: 'изменилось число записей этой толщины',
      });
    }
  }

  if (exact) {
    for (const [cm, now] of to) {
      if (from.has(cm)) continue;
      violations.push({
        invariant: 'wall_records', kind: 'count', owner: label(cm),
        reference: `было 0, стало ${now}`,
        detail: 'появились записи новой толщины',
      });
    }
  }

  return violations;
}
