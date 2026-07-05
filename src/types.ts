/** Общие типы карточки House Plan. */

export interface RoomCfg {
  id?: string;
  name: string;
  area: string | null;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  poly?: number[][]; // полигон в рендер-единицах (модель) / нормированный (конфиг)
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

/** Маркер конфига: правит/дополняет авто-устройство ИЛИ описывает ручной/виртуальный значок. */
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
  marker?: Marker; // связанный маркер конфига (метаданные, оверрайды)
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
}
