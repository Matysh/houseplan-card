import type { DecorShape } from './types';

/** The existing decor move owns the pointer; this is its immutable multi-selection begin state. */
export interface DecorSelectionPress {
  ids: readonly string[];
  items: readonly DecorShape[];
  screen: readonly [number, number];
  toggle: boolean;
  displaced: boolean;
  valid: boolean;
  authority: object;
  adoption: number;
  space: string;
}
