import type { PdfExportOptions } from './pdf-scene';

export interface SvgExportOptions {
  devices: boolean;
  decor: boolean;
  roomNames: boolean;
  backdrop: boolean;
  background: 'transparent' | 'current' | 'custom';
  color: string;
  opacity: number;
}
export type ExportRequest = { format: 'pdf'; options: PdfExportOptions }
  | { format: 'svg'; options: SvgExportOptions };

export const svgDefaults = (): SvgExportOptions => ({
  devices: false, decor: true, roomNames: true, backdrop: true,
  background: 'transparent', color: '#ffffff', opacity: 1,
});
