/** Room appearance read boundary. Legacy projection never mutates stored data. */
import { safeStoredColor } from './color';

export interface AppearanceColor { c: string; a: number }
export const DEFAULT_WALL_FILL: AppearanceColor = { c: '#ffffff', a: 1 };
export const DEFAULT_NAME_COLOR: AppearanceColor = { c: '#55606c', a: 0.8 };

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

export function appearanceColorOf(value: unknown, fallback: AppearanceColor): AppearanceColor {
  const raw = object(value);
  return {
    c: safeStoredColor(raw.c, fallback.c),
    a: typeof raw.a === 'number' && Number.isFinite(raw.a)
      ? Math.min(1, Math.max(0, raw.a)) : fallback.a,
  };
}

export function spaceAppearanceOf(space: unknown, general?: unknown): {
  nameColor: AppearanceColor; wallFill: AppearanceColor;
} {
  const settings = object(object(space).settings);
  const opacity = typeof settings.room_opacity === 'number' && Number.isFinite(settings.room_opacity)
    ? Math.min(1, Math.max(0, settings.room_opacity)) : 0.55;
  const legacyName = { c: safeStoredColor(settings.room_color, '#55606c'), a: Math.min(1, opacity + 0.25) };
  const legacyWall = appearanceColorOf(object(object(general).fill_colors).wall_fill, DEFAULT_WALL_FILL);
  return {
    nameColor: appearanceColorOf(settings.name_color, legacyName),
    wallFill: appearanceColorOf(settings.wall_fill, legacyWall),
  };
}

/** A null/absent room override inherits the entire colour, including alpha zero. */
export function roomNameColorOf(spaceName: AppearanceColor, room: unknown): AppearanceColor {
  return appearanceColorOf(object(object(room).settings).name_color, spaceName);
}

/** Warm drafts from before #1037 may omit the two new fields. Do not mutate
 * them on render (or dirty their baseline); materialise only on explicit Save. */
export function spaceDraftAppearanceOf(draft: {
  roomColor?: unknown; roomOpacity?: unknown; nameColor?: unknown; wallFill?: unknown;
}, space?: unknown, general?: unknown): { nameColor: AppearanceColor; wallFill: AppearanceColor } {
  const legacy = spaceAppearanceOf({settings:{room_color:draft.roomColor,room_opacity:draft.roomOpacity}},general);
  return {
    nameColor: appearanceColorOf(draft.nameColor,legacy.nameColor),
    wallFill: appearanceColorOf(draft.wallFill,spaceAppearanceOf(space,general).wallFill),
  };
}

/** Materialise a detached transfer/write copy before extracting a single floor. */
export function normalizeRoomAppearance<T extends { spaces?: unknown; settings?: unknown }>(config: T): T {
  if (!Array.isArray(config.spaces)) return config;
  return { ...config, spaces: config.spaces.map((space: unknown) => {
    const raw = object(space), settings = object(raw.settings);
    const resolved = spaceAppearanceOf(raw, config.settings);
    return { ...raw, settings: {
      ...settings,
      name_color: settings.name_color ?? resolved.nameColor,
      wall_fill: settings.wall_fill ?? resolved.wallFill,
    } };
  }) };
}
