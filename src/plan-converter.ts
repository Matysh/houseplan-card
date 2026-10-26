/** Code-version facts shared by onboarding and General Settings; no network lookup. */
export interface PlanConverterFormat { readonly name: string; readonly extensions: readonly string[] }
export const PLAN_CONVERTER = {
  url: 'https://houseplan.tech/convert/',
  formats: [
    { name: 'Sweet Home 3D', extensions: ['.sh3d'] },
    { name: 'Easy Floorplan', extensions: ['YAML', 'JSON'] },
  ] as readonly PlanConverterFormat[],
} as const;

export function planConverterFormats(formats: readonly PlanConverterFormat[] = PLAN_CONVERTER.formats, separator = ', '): string {
  return formats.map(format => `${format.name} (${format.extensions.join(' / ')})`).join(separator);
}
