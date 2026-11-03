/** Wire fixtures, not a runtime resolver: keep legacy rows explicit. */
export const legacyScreenDefaults = id => ({ id, space: null, rotation: 0, cycle: 0, idle: 0,
  summary: 'local', hidden_devices: 'local', icon_scale: null, font_scale: null, controls: true });
export const viewDefaults = () => ({ rotation: 0, zoom: 1, summary: 'local', center_summary: false,
  icon_scale: null, font_scale: null });
export const screenDefaults = (id, version = 2) => version === 1 ? legacyScreenDefaults(id)
  : { id, space: null, cycle: 0, idle: 0, default_view: viewDefaults(), space_views: {} };
export function currentProfile(row) {
  if (row.default_view) return structuredClone(row);
  const { rotation, summary, icon_scale, font_scale, hidden_devices, controls, ...rest } = row;
  return { ...rest, default_view: { ...viewDefaults(), rotation, summary, icon_scale, font_scale }, space_views: {} };
}
export const profileNamespace = config => config.settings?.external_screens;
export const profileOf = (config, id) => profileNamespace(config)?.screens.find(row => row.id === id);
export function profileView(config, id, space) {
  const row = profileOf(config, id);
  return row?.default_view ? row.space_views[space] ?? row.default_view : row;
}
