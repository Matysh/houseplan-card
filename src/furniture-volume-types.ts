/** Source coordinates normalize inside the saved furniture footprint. Heights are cm. */
export interface FurniturePart {
  name: string;
  x: number; y: number; w: number; h: number; radius: number;
  bottom: number; top: number;
  /** Schema 2: closed profile, optional opening and extrusion plane. */
  profile?: 'rect' | 'ellipse' | 'polygon';
  points?: readonly (readonly [number,number])[];
  hole?: readonly (readonly [number,number])[];
  plane?: 'xy' | 'xz' | 'yz';
  inset?: readonly [number,number,number];
  baseScale?: number;
  topScale?: number;
  topOffset?: readonly [number,number];
}
export type FurnitureVolumeModels = Readonly<Record<string,readonly FurniturePart[]>>;
