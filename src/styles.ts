/**
 * Styles of the House Plan card — assembled from the surface files (#266).
 *
 * The ORDER of this array is part of the cascade contract: rules of equal
 * specificity resolve by position, and the golden set was accepted against
 * exactly this order. Do not reorder without re-reviewing the golden set.
 */
import type { CSSResultGroup } from 'lit';
import { baseStyles } from './styles/base.styles';
import { planStyles } from './styles/plan.styles';
import { devicesStyles } from './styles/devices.styles';
import { chromeStyles } from './styles/chrome.styles';
import { dialogsStyles } from './styles/dialogs.styles';

export { baseStyles, planStyles, devicesStyles, chromeStyles, dialogsStyles };

export const cardStyles: CSSResultGroup = [
  baseStyles, planStyles, devicesStyles, chromeStyles, dialogsStyles,
];
