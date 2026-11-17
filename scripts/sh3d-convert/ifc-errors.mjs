/** Stable diagnostic codes shared by the IFC reader, worker and converter. */
export class IfcError extends Error {
  constructor(code, detail = '') { super(detail || code); this.name = 'IfcError'; this.code = code; }
}
export const MAX_IFC_BYTES = 64 * 1024 * 1024;
