/** Read-only HA enrichment for smart-home values, not a PlanHost presentation port. */
interface HaFormatterSource {
  formatEntityState?: unknown;
  formatEntityAttributeValue?: unknown;
}

export function haValueFormatters(source: HaFormatterSource | null | undefined) {
  // HA methods may read locale/config through this. Capture the actual source,
  // not the projected state dictionary, and never lend any of its other fields.
  // Consumers retain their existing missing/throwing-formatter raw fallbacks.
  return {
    formatEntityState: typeof source?.formatEntityState === 'function'
      ? source.formatEntityState.bind(source) : undefined,
    formatEntityAttributeValue: typeof source?.formatEntityAttributeValue === 'function'
      ? source.formatEntityAttributeValue.bind(source) : undefined,
  };
}
