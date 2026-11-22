import { deviceTextScale, legacySupplementalMetrics } from './device-face';
import type { ResolvedDevicePresentation } from './device-presentation';

export const ISO_TEXT_ADVANCE = Object.freeze({
  textLatinAdvance: 0.72, textWideAsciiAdvance: 1, textWideAdvance: 1.1, textSpaceAdvance: 0.4, textWidthSafety: 1.08,
});

/** Shared authored, ungrouped diameter (the desktop contact solver may
 * override it with an accepted basis). Keep the multiplication order shared. */
export const nominalDeviceCore = (pct: number, unit: number, scale: number, iconScale: number) =>
  pct * (unit / 100) * scale * iconScale;

export function conservativeTextAdvance(text: string): number {
  return [...String(text)].reduce((sum, char) => {
    if (/\s/.test(char)) return sum + ISO_TEXT_ADVANCE.textSpaceAdvance;
    if (/[MW@#%&]/.test(char)) return sum + ISO_TEXT_ADVANCE.textWideAsciiAdvance;
    return sum + (char.codePointAt(0)! > 0xff ? ISO_TEXT_ADVANCE.textWideAdvance : ISO_TEXT_ADVANCE.textLatinAdvance);
  }, 0) * ISO_TEXT_ADVANCE.textWidthSafety;
}

/** Numeric state-derived inputs to the live footprint. Never persist text,
 * entity states or HA identifiers in a portable geometry document. */
export function isoDeviceFitInputs(p: ResolvedDevicePresentation) {
  const advance = (text: string, full?: string | null) => conservativeTextAdvance(text) * deviceTextScale(full || text);
  const sections = p.valueBadge ? [advance(p.valueBadge.text, p.valueBadge.fullText)] : [];
  for (const metric of legacySupplementalMetrics(p)) {
    const text = metric.text + metric.suffix;
    sections.push(advance(text));
  }
  return {
    value: p.valueText == null ? null : advance(p.valueText, p.valueFullText),
    sections, position: p.valueBadge?.position || 'right',
    pulse: p.pulse.animated ? Math.max(1, p.pulse.diameterScale) / 2 : null,
    lqi: p.lqiText == null ? null : conservativeTextAdvance(p.lqiText),
  };
}
