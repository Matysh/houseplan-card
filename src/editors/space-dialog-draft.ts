/** Shared data projection: adding a room metric cannot diverge between the
 * editor, first-run onboarding and queued plan imports. These factories stay lazy. */
import { DEFAULT_CUSTOM_FILL, DEFAULT_ROOM_COLOR, DEFAULT_ROOM_OPACITY,
  DEFAULT_TEMP_MIN, DEFAULT_TEMP_MAX, customFillOf, spaceDisplayOf } from '../logic';
import { initialSpaceDisplayDraft, type SpaceDialogState } from '../space-dialog';
import { gridCellFieldValue, newSpaceCellCm } from '../grid-scale';
import { spaceDeviceBatteryModeOf, writeSpaceDeviceBatterySetting } from '../device-battery-settings';
import { northDegOf } from '../sun';
import { signalVisibilityModeOf, writeSpaceSignalVisibility, type SignalSpaceSettings } from '../signal-visibility';
import { zeroWallStyleOf } from '../zero-walls';
import { DEFAULT_NAME_COLOR, DEFAULT_WALL_FILL, spaceDraftAppearanceOf } from '../room-appearance';

interface SavedSpace {
  id: string; title: string; plan_url?: string | null; cell_cm?: number;
  settings?: Record<string, unknown>;
}

export function newSpaceDialogDraft(imperial: boolean): SpaceDialogState {
  const cellCm = newSpaceCellCm(imperial);
  return {
    mode: 'create', title: '', planUrl: null, planFile: null,
    ...initialSpaceDisplayDraft(), hideDecor: false, hideOpenings: false, zeroWallStyle: 'dashed',
    roomColor: DEFAULT_ROOM_COLOR, roomOpacity: DEFAULT_ROOM_OPACITY, fillMode: 'custom',
    nameColor: { ...DEFAULT_NAME_COLOR }, wallFill: { ...DEFAULT_WALL_FILL },
    customFill: { ...DEFAULT_CUSTOM_FILL, a: 0 }, glowEnabled: true, bgColor: null,
    bgMode: 'daynight', northDeg: null, northDegInput: '', sunRays: null,
    tempMin: DEFAULT_TEMP_MIN, tempMax: DEFAULT_TEMP_MAX,
    tempMinInput: String(DEFAULT_TEMP_MIN), tempMaxInput: String(DEFAULT_TEMP_MAX),
    showLqiMode: 'inherit', cardFontScale: 1, cardNameScale: 1, cardLabelScale: 1, deviceBatteryMode: 'inherit',
    labelTemp: false, labelHum: false, labelCo2: false, labelLqi: false, labelLight: false,
    cellCm, cellCmInput: gridCellFieldValue(cellCm, imperial), cellCmTouched: false, busy: false,
  };
}

export function savedSpaceDialogDraft(sp: SavedSpace, imperial: boolean, globalMode?: unknown, general?: unknown): SpaceDialogState {
  const disp = spaceDisplayOf(sp, general), north = northDegOf({}, sp.settings);
  const storedCustom = sp.settings?.custom_fill && typeof sp.settings.custom_fill === 'object'
    ? customFillOf(sp.settings.custom_fill) : null;
  const cellCm = Number(sp.cell_cm) > 0 ? Number(sp.cell_cm) : 5;
  return {
    mode: 'edit', spaceId: sp.id, title: sp.title, planUrl: sp.plan_url || null, planFile: null,
    source: sp.plan_url ? 'file' : 'draw', showBorders: disp.showBorders, showNames: disp.showNames,
    zeroWallStyle: zeroWallStyleOf(sp), displayTouched: true,
    hideDecor: disp.hideDecor, hideOpenings: disp.hideOpenings, roomColor: disp.color, roomOpacity: disp.opacity,
    nameColor: disp.nameColor, wallFill: disp.wallFill,
    fillMode: disp.fill === 'none' ? 'custom' : disp.fill,
    customFill: disp.fill === 'none' ? { ...(storedCustom || DEFAULT_CUSTOM_FILL), a: 0 } : storedCustom,
    glowEnabled: disp.glow, bgColor: disp.bgColor,
    bgMode: sp.settings?.bg_mode === 'static' || sp.settings?.bg_mode === 'daynight' ? sp.settings.bg_mode : disp.bgColor && globalMode !== 'daynight' ? 'static' : null,
    northDeg: north, northDegInput: north === null ? '' : String(north),
    sunRays: typeof sp.settings?.sun_rays === 'boolean' ? sp.settings.sun_rays : null,
    tempMin: disp.tempMin, tempMax: disp.tempMax, tempMinInput: String(disp.tempMin), tempMaxInput: String(disp.tempMax),
    showLqiMode: signalVisibilityModeOf(sp.settings), cardFontScale: disp.cardFontScale,
    cardNameScale: disp.cardNameScale, cardLabelScale: disp.cardLabelScale, deviceBatteryMode: spaceDeviceBatteryModeOf(sp.settings),
    labelTemp: disp.labelTemp, labelHum: disp.labelHum, labelCo2: disp.labelCo2,
    labelLqi: disp.labelLqi, labelLight: disp.labelLight,
    cellCm, cellCmInput: gridCellFieldValue(cellCm, imperial), cellCmTouched: false, busy: false,
  };
}

/** Preserve unknown saved fields; both space writers materialise the same flags. */
export function spaceDialogSettings(d: SpaceDialogState, previous?: Record<string, unknown>, general?: unknown): Record<string, unknown> {
  const appearance = spaceDraftAppearanceOf(d,{settings:previous},general);
  const settings: Record<string, unknown> & SignalSpaceSettings & { show_device_battery_mode?: unknown } = {
    ...previous,
    show_borders: d.showBorders,
    show_names: d.showNames,
    hide_decor: d.hideDecor || undefined, hide_openings: !d.showBorders || undefined,
    room_color: d.roomColor, room_opacity: d.roomOpacity, bg_color: d.bgColor || undefined,
    name_color: { ...((previous?.name_color as Record<string, unknown> | undefined) || {}), ...appearance.nameColor },
    wall_fill: { ...((previous?.wall_fill as Record<string, unknown> | undefined) || {}), ...appearance.wallFill },
    bg_mode: d.bgMode || undefined, north_deg: d.northDeg ?? undefined, sun_rays: d.sunRays ?? undefined,
    fill_mode: d.fillMode, custom_fill: d.customFill || undefined, glow_enabled: true,
    temp_min: Number.isFinite(d.tempMin) ? Math.min(d.tempMin, d.tempMax) : DEFAULT_TEMP_MIN,
    temp_max: Number.isFinite(d.tempMax) ? Math.max(d.tempMin, d.tempMax) : DEFAULT_TEMP_MAX,
    card_name_scale: d.cardNameScale, card_label_scale: d.cardLabelScale,
    label_temp: d.labelTemp, label_hum: d.labelHum, label_co2: d.labelCo2,
    label_lqi: d.labelLqi, label_light: d.labelLight,
  };
  writeSpaceDeviceBatterySetting(settings, d.deviceBatteryMode);
  return writeSpaceSignalVisibility(settings, d.showLqiMode);
}
