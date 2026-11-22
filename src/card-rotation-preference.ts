import { cacheSha256 } from './floor-cache-key';
import { validPlanRotation, type PlanRotation } from './view-frame';

type RotationStorage = Pick<Storage, 'getItem' | 'setItem'>;
type RotationValues = Record<string, PlanRotation>;
const EMPTY = (): RotationValues => Object.create(null);

/** Local View controls belong to one full Lovelace card and its stable slot. */
export class CardRotationPreference {
  private owner: object | null = null;
  private address: string | null = null;
  private key: string | null = null;
  private author = '';
  private values = EMPTY();

  constructor(private readonly storage: () => RotationStorage | undefined) {}

  configure(owner: object, address: readonly string[] | null, author: readonly unknown[]): void {
    const identity = address && JSON.stringify(address);
    const authored = JSON.stringify(author);
    if (owner === this.owner && identity === this.address && authored === this.author) return;
    const read = owner !== this.owner || identity !== this.address;
    this.owner = owner;
    this.address = identity;
    this.author = authored;
    this.key = identity && `houseplan_card_rotation_slot_v1:${cacheSha256(identity)}`;
    this.values = EMPTY();
    if (read) this.values = this.read();
  }

  private read(): RotationValues {
    const values = EMPTY();
    if (!this.key) return values;
    try {
      const stored = JSON.parse(this.storage()?.getItem(this.key) ?? 'null');
      if (stored?.author === this.author && stored.values && typeof stored.values === 'object'
        && !Array.isArray(stored.values)) {
        for (const [space, angle] of Object.entries(stored.values)) {
          if (space && validPlanRotation(angle)) values[space] = angle;
        }
      }
    } catch { /* Invalid or unavailable storage falls back to this card's memory. */ }
    return values;
  }

  get(space: string): PlanRotation | undefined { return this.values[space]; }

  set(space: string, angle: PlanRotation): void {
    this.values[space] = angle;
    if (!this.key) return;
    // Another tab may have recorded a choice for a different space.
    this.values = Object.assign(EMPTY(), this.values, this.read(), { [space]: angle });
    try { this.storage()?.setItem(this.key, JSON.stringify({ author: this.author, values: this.values })); }
    catch { /* An unavailable browser store does not block the current card. */ }
  }
}
