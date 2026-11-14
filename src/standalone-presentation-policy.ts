/** Explicit document ownership; never infer standalone from a not-yet-loaded HA. */
export const STANDALONE_ELEMENTS = ['ha-icon', 'ha-card', 'ha-circular-progress'] as const;
export const HA_BRANCH_ELEMENTS = ['home-assistant', 'ha-dialog', 'ha-switch', 'ha-slider'] as const;

export function assertStandaloneRegistry(
  registry: Pick<CustomElementRegistry, 'get'>,
  hasHaRoot: boolean,
  own: ReadonlyMap<string, CustomElementConstructor> = new Map(),
): void {
  if (hasHaRoot || HA_BRANCH_ELEMENTS.some(name => registry.get(name))
      || STANDALONE_ELEMENTS.some(name => {
        const current = registry.get(name);
        return current && current !== own.get(name);
      })) throw new Error('House Plan standalone presentation requires a separate document without Home Assistant');
}
