/** Decor is annotation, never an input to physical walls or light barriers.
 * Retain every other field, including unknown compatible structural inputs. */
export function structuralSpaceRecord(record: unknown, ...nonStructural: readonly string[]): unknown {
  return record && typeof record === 'object' && !Array.isArray(record)
    ? Object.fromEntries(Object.keys(record).filter(key => key !== 'decor' && !nonStructural.includes(key))
      .map(key => [key, (record as Record<string, unknown>)[key]])) : record;
}

// These are read by paint/text, metric, solar or device consumers, never by
// masonry/clean-floor geometry. Visibility is still part of the contact and
// light consumers' own demand keys. Unknown compatible settings stay physical.
const DISPLAY_SETTINGS = new Set([
  'bg_mode', 'bg_color', 'room_color', 'room_opacity', 'name_color', 'wall_fill',
  'show_names', 'show_borders', 'hide_decor', 'hide_openings', 'fill_mode', 'custom_fill',
  'glow_enabled', 'temp_min', 'temp_max', 'card_name_scale', 'card_label_scale',
  'label_temp', 'label_hum', 'label_co2', 'label_lqi', 'label_light',
  'north_deg', 'sun_rays', 'sun_transparent', 'sun_ray_origin',
  'show_lqi', 'show_lqi_mode', 'show_device_battery_mode',
  'glow', 'temp_source', 'hum_source', 'co2_source', 'name_scale', 'label_scale',
]);

function physicalRecord(record: unknown, excluded: readonly string[]): unknown {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return record;
  const value = record as Record<string, unknown>;
  const projected = Object.fromEntries(Object.keys(value).filter(key => !excluded.includes(key))
    .map(key => [key, value[key]]));
  const settings = projected.settings;
  if (settings && typeof settings === 'object' && !Array.isArray(settings)) {
    const retained = Object.fromEntries(Object.keys(settings).filter(key => !DISPLAY_SETTINGS.has(key))
      .map(key => [key, (settings as Record<string, unknown>)[key]]));
    if (Object.keys(retained).length) projected.settings = retained;
    else delete projected.settings;
  }
  return projected;
}

/** Consumer projection only. Wire/history keep the complete saved record.
 * Malformed/null settings and every unrecognised field remain significant. */
export function physicalSpaceRecord(record: unknown, ...nonStructural: readonly string[]): unknown {
  const structural = physicalRecord(record, ['decor', 'title', ...nonStructural]) as Record<string, unknown> | null;
  // The write canonicalizer drops these empty legacy collections. Both forms
  // supply no physical primitives; an ACK must not cool an untouched floor.
  if (structural && typeof structural === 'object' && !Array.isArray(structural)) {
    // Native draw saves materialize these already-effective defaults. Preserve
    // meaningful values and all unknown fields; only these canonical forms are
    // equivalent to absence in spaceModels/zeroWallStyleOf.
    for (const key of ['plan_url', 'plan_aspect']) if (structural[key] === null) delete structural[key];
    if (structural.zero_wall_style === 'dashed') delete structural.zero_wall_style;
    for (const key of ['walls', 'partitions']) {
      if (Array.isArray(structural[key]) && structural[key].length === 0) delete structural[key];
    }
  }
  if (!structural || !Array.isArray(structural.rooms)) return structural;
  return { ...structural, rooms: structural.rooms.map(room => physicalRecord(room, ['name', 'area'])) };
}
