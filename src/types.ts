/** Shared types of the House Plan card. */

import type { HaBindingStatus } from './ha-binding-status';

export interface RoomCfg {
  /** Deprecated pre-v9 room links used only by legacy compatibility readers. */
  open_to?: string[] | null;
  /** Room-level settings (tier 3 of 4: global > space > ROOM > device). */
  settings?: {
    /** Fill override; unset = inherit the space fill mode. */
    /** `glow` is a permanent legacy read token. */
    fill_mode?: 'none' | 'lqi' | 'light' | 'temp' | 'custom' | 'glow' | null;
    /** Explicit custom fill; absent/null uses the space custom fill. */
    custom_fill?: { c: string; a: number } | null;
    /** Independent per-room Glow override; null/absent inherits the space. */
    glow?: boolean | null;
    /** 'device:<id>' or 'entity:<eid>'; unset = average over the room sensors. */
    temp_source?: string | null;
    hum_source?: string | null;
    /** Font multipliers for THIS room's card (0.5-3, unset = 1). */
    name_scale?: number | null;
    label_scale?: number | null;
  } | null;
  id?: string;
  name: string;
  area: string | null;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  poly?: number[][]; // polygon in render units (model) / normalized (config)
  /** v8: one stable contour-wall id for every edge in `poly`. */
  wall_ids?: string[];
}

/** Wall thickness entry (docs/WALL-THICKNESS.md) — always centimetres in config. */
export interface WallEntry {
  key: string;
  cm: number;
  /** Exact interval endpoints in normalized config coordinates (new writes). */
  a?: number[];
  b?: number[];
}

/** Canonical v8 contour-wall atom. `cm: 0` is a thin contour, not masonry. */
export interface WallSegmentEntry {
  id: string;
  a: number[];
  b: number[];
  cm: number;
  [key: string]: unknown;
}

export type ZeroWallStyle = 'dashed' | 'solid';

/** Persisted open room contour. Coordinates are normalised in config and
 * render units in SpaceModel, exactly like rooms. */
export interface RoomDraftCfg {
  id: string;
  points: number[][];
  /** One thickness entry for every consecutive pair of points. */
  segments: Array<{ id?: string; cm: number }>;
}

/** A single independent physical wall which never owns or splits a room. */
export interface PartitionCfg {
  id: string;
  a: number[];
  b: number[];
  cm: number;
}

/** A physical column. `cm` is the outer side/diameter. */
export type WallColumnCfg =
  | { id: string; shape: 'square'; center: number[]; cm: number; angle?: number }
  | { id: string; shape: 'circle'; center: number[]; cm: number };

export interface SpaceModel {
  id: string;
  title: string;
  /** Canonical centimetres represented by one stored grid cell. */
  cellCm?: number;
  vb: number[]; // render units
  bg: { href: string; x: number; y: number; w: number; h: number; angle?: number } | null;
  rooms: RoomCfg[]; // render units
  /** Canonical contour-wall atoms in render units. */
  wall_segments: WallSegmentEntry[];
  room_drafts: RoomDraftCfg[];
  partitions: PartitionCfg[];
  wall_columns: WallColumnCfg[];
}

export interface PdfRef {
  name: string;
  url: string;
}

export type ValueBadgePosition = 'right' | 'bottom' | 'left' | 'top';

export type ValueBadgeSource =
  | { kind: 'entity_state'; entity_id: string }
  | { kind: 'entity_attribute'; entity_id: string; attribute: string }
  | { kind: 'derived_lqi' }
  | { kind: 'derived_marker_state'; ref: `marker:${string}` };

export interface MarkerValueBadge {
  enabled: boolean;
  source?: ValueBadgeSource | null;
  position: ValueBadgePosition;
}

/** Config marker: edits/augments an auto-discovered device OR describes a manual/virtual icon. */
export interface Marker {
  id: string;
  binding: string; // 'device:<id>' | 'entity:<eid>' | 'virtual'
  space?: string | null;
  area?: string | null;
  hidden?: boolean;
  /** Tombstone: excluded from every plan renderer/aggregate, but its binding
   * remains available in the Add-device picker. */
  removed?: boolean;
  name?: string | null;
  icon?: string | null;
  model?: string | null;
  link?: string | null;
  description?: string | null;
  pdfs?: PdfRef[];
  /** Per-device override. `cover` is legacy read/import compatibility only;
   * the current editor writes `toggle`. */
  tap_action?: string | null;
  /** 'run' target: automation./script./scene. entity id. */
  tap_target?: string | null;
  /** Ask before toggle/run — accidental-tap guard (owner's spec). */
  tap_confirm?: boolean | null;
  /** live robot vacuum (docs/VACUUM.md); absent on non-vacuum markers */
  vacuum?: {
    live?: boolean | null;
    trail?: boolean | null; // legacy bool; trail_mode wins
    trail_mode?: 'never' | 'cleaning' | 'always' | null;
    room_highlight?: boolean | null;
    source?: string | null;
    calibration?: Record<string, number[]>;
    segment_map?: Record<string, string>;
  } | null;
  room_id?: string | null; // manual placement into a room WITHOUT an HA area (sub-area rooms)
  /** `ripple` is legacy read compatibility; UI maps it to icon_ripple. */
  display?: 'badge' | 'ripple' | 'icon_ripple' | 'value' | 'static_icon' | null; // how the device is drawn
  ripple_color?: string | null;
  ripple_size?: number | null; // max ring diameter, in icon diameters (default 1.5)
  size?: number | null;        // icon size multiplier (default 1)
  angle?: number | null;       // icon rotation, degrees
  /** Entities this icon toggles as a group (wall switch → its lights). */
  controls?: string[] | null;
  /** Per-source glow radius in cm (glow fill); null = the global default. */
  glow_radius_cm?: number | null;
  /**
   * Optional visual override for this source's Glow. Missing/null = use the
   * live light colour and brightness; `bri` omitted/null keeps live brightness.
   */
  glow_color?: { c: string; bri?: number | null } | null;
  /**
   * Light-source role: true = always use the marker's own controllable entity,
   * false = never use its own entity, null/undefined = automatic discovery.
   * External `controls` remain independent room-light votes in every mode.
   */
  is_light?: boolean | null;
  /** Explicit leading controllable entity for an Always source. Missing keeps
   * the compatibility fallback (entity binding -> primary -> first control). */
  light_entity?: string | null;
  /** Exact own light/switch selected for Toggle. Missing/null keeps the
   * historical action resolver and external-only controls groups. */
  toggle_entity?: string | null;
  /** Optional, user-controlled value satellite around the device face.
   * Missing keeps the legacy temperature/humidity compatibility heuristic. */
  value_badge?: MarkerValueBadge | null;
  /**
   * Climate devices (AC, thermostat) know the room temperature
   * (attributes.current_temperature). Opt-in per marker: show it as a badge
   * next to the icon and include it in the room average. null/absent = off —
   * nothing changes without an explicit tick (owner's spec, 2026-08-03).
   */
  use_climate_temp?: boolean | null;
}

/** A door, window, gate or open passage: plan geometry (normalized coords). */
export interface PartitionOpeningHost {
  kind: 'partition';
  /** Stable id of one saved independent wall segment in the same space. */
  id: string;
  /** Centre position along the directed partition a -> b. */
  t: number;
}

export interface WallOpeningHost {
  kind: 'wall';
  /** Stable id of one authoritative contour-wall atom in the same space. */
  id: string;
  /** Centre position along the canonical stored segment a -> b. */
  t: number;
}

export type OpeningHost = PartitionOpeningHost | WallOpeningHost;

export interface OpeningCfg {
  id: string;
  type: 'door' | 'window' | 'gate' | 'passage';
  x: number;       // center, normalized by plan width
  y: number;       // center, normalized by plan height
  angle: number;   // wall angle, degrees
  length: number;  // along the wall, normalized by plan width
  contact?: string | null; // binary_sensor / cover driving open-closed
  lock?: string | null;    // lock entity (door-like openings: doors and gates)
  invert?: boolean;
  flip_h?: boolean; // hinge on the other jamb
  flip_v?: boolean; // opens to the other side of the wall
  /** Explicit owner for an opening cut into an independent wall. */
  host?: OpeningHost;
}

export interface ServerConfig {
  model_version?: number;
  spaces: any[];
  markers: Marker[];
  settings: {
    exclude_integrations?: string[];
    group_lights?: boolean;
    show_all?: boolean; // legacy: removed when the config is materialised
  /** The filter flags are materialised into markers (docs/FILTERING.md). */
  filter_seeded?: boolean;
    icon_rules?: { pattern: string; icon: string }[];
  };
}

export interface DevItem {
  id: string;
  name: string;
  model: string;
  area: string;
  space: string;
  /** Effective presentation hide: explicit user hide OR HA-disabled. */
  hidden?: boolean;
  /** Persisted user choice only; never inferred from HA runtime status. */
  userHidden?: boolean;
  /** Central registry decision. Virtual/legacy items are active. */
  bindingStatus?: HaBindingStatus;
  icon: string;
  /** Active runtime entities only. */
  entities: string[];
  /** Registry metadata only; never use for states/actions/aggregates. */
  allEntities?: string[];
  primary?: string;
  temp?: number | null;
  hum?: number | null;
  virtual?: boolean;
  marker?: Marker; // linked config marker (metadata, overrides)
  /** Runtime-effective controls. The marker retains the user's complete
   * persisted list so transient tombstones cannot erase it on the next save. */
  controls?: string[];
  bindingKind?: 'device' | 'entity' | 'virtual';
  bindingRef?: string; // device_id / entity_id
  link?: string | null;
  description?: string | null;
  pdfs?: PdfRef[];
  tapAction?: string | null; // from the marker override
}

export interface CardConfig {
  type: string;
  title?: string;
  floor?: string | number;
  default_floor?: string;
  icon_size?: number;
  show_temperature?: boolean;
  live_states?: boolean;
  show_signal?: boolean;
  language?: string; // 'en' | 'ru' | '' (auto — HA profile)
  /** @deprecated Ignored since v1.38.1 — per-marker `tap_action` only.
   *  Kept so old YAML does not break; no runtime action reads this field. */
  tap_action?: string;
  /** Wall-device (kiosk) mode: no header, no editors, swipe between spaces. */
  kiosk?: boolean;
  /** Kiosk auto-carousel: seconds between space switches, 0/undefined = off. */
  cycle?: number;
}
