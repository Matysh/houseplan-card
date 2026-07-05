/** Shared types of the House Plan card. */

export interface RoomCfg {
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
}

export interface ServerConfig {
  spaces: any[];
  markers: Marker[];
  settings: { exclude_integrations?: string[]; group_lights?: boolean; show_all?: boolean };
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
  virtual?: boolean;
  marker?: Marker; // linked config marker (metadata, overrides)
  bindingKind?: 'device' | 'entity' | 'virtual';
  bindingRef?: string; // device_id / entity_id
  link?: string | null;
  description?: string | null;
  pdfs?: PdfRef[];
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
}
