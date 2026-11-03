import { langOf } from './i18n';
import { cardPickerText, type PickerCardType } from './i18n/registry';

/** HA reads customCards before constructing a card. Resolve its current
 * profile at read time, so initial load and later language changes both work.
 */
export function registerPickerCard(
  type: PickerCardType,
  options: { preview?: boolean; documentation?: string } = {},
): void {
  const cards = (window as any).customCards ||= [];
  if (cards.some((card: { type: string }) => card.type === type)) return;
  const text = () => {
    const root = typeof document === 'undefined' ? null
      : document.querySelector('home-assistant') as (HTMLElement & { hass?: unknown }) | null;
    return cardPickerText(langOf(root?.hass), type);
  };
  cards.push({
    type,
    ...options,
    get name() { return text().name; },
    get description() { return text().description; },
  });
}
