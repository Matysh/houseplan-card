/** Shared types of the House Plan card. */

import type { HaBindingStatus } from './ha-binding-status';

export interface RoomCfg {
  /** Rooms this one has an OPEN (virtual) boundary with - light flows through. */
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
}

/** Wall thickness entry (docs/WALL-THICKNESS.md) — always centimetres in config. */
export interface WallEntry {
  key: string;
  cm: number;
  /** Exact interval endpoints in normalized config coordinates (new writes). */
  a?: number[];
  b?: number[];
}

/** Persisted open room contour. Coordinates are normalised in config and
 * render units in SpaceModel, exactly like rooms. */
export interface RoomDraftCfg {
  id: string;
  points: number[][];
  /** One thickness entry for every consecutive pair of points. */
  segments: Array<{ cm: number }>;
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
  vb: number[]; // render units
  bg: { href: string; x: number; y: number; w: number; h: number; angle?: number } | null;
  rooms: RoomCfg[]; // render units
  room_drafts: RoomDraftCfg[];
  partitions: PartitionCfg[];
  wall_columns: WallColumnCfg[];
}

export interface PdfRef {
  name: string;
  url: string;
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
  tap_action?: string | null; // per-device override: 'info' | 'more-info' | 'toggle'
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
  ripple_size?: number | null; // max ring diameter, in icon diameters (default 3)
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
  /**
   * Climate devices (AC, thermostat) know the room temperature
   * (attributes.current_temperature). Opt-in per marker: show it as a badge
   * next to the icon and include it in the room average. null/absent = off —
   * nothing changes without an explicit tick (owner's spec, 2026-08-03).
   */
  use_climate_temp?: boolean | null;
}

/** A door, window or gate: plan geometry (normalized coords), optionally live via entities. */
export interface OpeningCfg {
  id: string;
  type: 'door' | 'window' | 'gate';
  x: number;       // center, normalized by plan width
  y: number;       // center, normalized by plan height
  angle: number;   // wall angle, degrees
  length: number;  // along the wall, normalized by plan width
  contact?: string | null; // binary_sensor / cover driving open-closed
  lock?: string | null;    // lock entity (door-like openings: doors and gates)
  invert?: boolean;
  flip_h?: boolean; // hinge on the other jamb
  flip_v?: boolean; // opens to the other side of the wall
}

export interface ServerConfig {
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
  default_floor?: string;
  icon_size?: number;
  show_temperature?: boolean;
  live_states?: boolean;
  show_signal?: boolean;
  language?: string; // 'en' | 'ru' | '' (auto — HA profile)
  /** @deprecated Ignored since v1.38.1 — per-marker `tap_action` only.
   *  Kept so old YAML does not break; `resolveTapAction`'s cardDefault is
   *  never wired from this field (audit P3-5). */
  tap_action?: string;
  /** Wall-device (kiosk) mode: no header, no editors, swipe between spaces. */
  kiosk?: boolean;
  /** Kiosk auto-carousel: seconds between space switches, 0/undefined = off. */
  cycle?: number;
}
