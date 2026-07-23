/** Shared types of the House Plan card. */

export interface RoomCfg {
  /** Rooms this one has an OPEN (virtual) boundary with — light flows through. */
  open_to?: string[] | null;
  id?: string;
  name: string;
  area: string | null;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  poly?: number[][]; // polygon in render units (model) / normalized (config)
}

export interface SpaceModel {
  id: string;
  title: string;
  vb: number[]; // render units
  bg: { href: string; x: number; y: number; w: number; h: number } | null;
  rooms: RoomCfg[]; // render units
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
  name?: string | null;
  icon?: string | null;
  model?: string | null;
  link?: string | null;
  description?: string | null;
  pdfs?: PdfRef[];
  tap_action?: string | null; // per-device override: 'info' | 'more-info' | 'toggle'
  room_id?: string | null; // manual placement into a room WITHOUT an HA area (sub-area rooms)
  display?: 'badge' | 'ripple' | 'icon_ripple' | 'value' | null; // how the device is drawn
  ripple_color?: string | null;
  ripple_size?: number | null; // max ring diameter, in icon diameters (default 3)
  size?: number | null;        // icon size multiplier (default 1)
  angle?: number | null;       // icon rotation, degrees
  /** Entities this icon toggles as a group (wall switch → its lights). */
  controls?: string[] | null;
  /** Per-source glow radius in cm (glow fill); null = the global default. */
  glow_radius_cm?: number | null;
}

/** A door or window: plan geometry (normalized coords), optionally live via entities. */
export interface OpeningCfg {
  id: string;
  type: 'door' | 'window';
  x: number;       // center, normalized by plan width
  y: number;       // center, normalized by plan height
  angle: number;   // wall angle, degrees
  length: number;  // along the wall, normalized by plan width
  contact?: string | null; // binary_sensor / cover driving open-closed
  lock?: string | null;    // lock entity (doors only)
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
    show_all?: boolean;
    icon_rules?: { pattern: string; icon: string }[];
  };
}

export interface DevItem {
  id: string;
  name: string;
  model: string;
  area: string;
  space: string;
  icon: string;
  entities: string[];
  primary?: string;
  temp?: number | null;
  hum?: number | null;
  virtual?: boolean;
  marker?: Marker; // linked config marker (metadata, overrides)
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
  tap_action?: string; // legacy, ignored since v1.38.1
  /** Wall-device (kiosk) mode: no header, no editors, swipe between spaces. */
  kiosk?: boolean;
  /** Kiosk auto-carousel: seconds between space switches, 0/undefined = off. */
  cycle?: number;
}
