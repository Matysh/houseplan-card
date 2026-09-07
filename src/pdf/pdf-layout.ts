import type { PdfVectorOp } from './svg-path';
import { pdfTextBounds, type PdfCommand } from './pdf-writer';

export interface PdfBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface PdfField extends PdfBounds {}

export const emptyPdfBounds = (): PdfBounds => ({
  minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity,
});

export const validPdfBounds = (bounds: PdfBounds): boolean =>
  [bounds.minX, bounds.minY, bounds.maxX, bounds.maxY].every(Number.isFinite)
  && bounds.maxX >= bounds.minX && bounds.maxY >= bounds.minY;

export const pdfBoundsWidth = (bounds: PdfBounds): number => bounds.maxX - bounds.minX;
export const pdfBoundsHeight = (bounds: PdfBounds): number => bounds.maxY - bounds.minY;

function extend(bounds: PdfBounds, x: number, y: number, padding = 0): void {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  bounds.minX = Math.min(bounds.minX, x - padding);
  bounds.minY = Math.min(bounds.minY, y - padding);
  bounds.maxX = Math.max(bounds.maxX, x + padding);
  bounds.maxY = Math.max(bounds.maxY, y + padding);
}

function extendRotatedRect(
  bounds: PdfBounds, x: number, y: number, width: number, height: number, angleDeg: number,
): void {
  const radians = angleDeg * Math.PI / 180;
  const c = Math.cos(radians), s = Math.sin(radians);
  const cx = x + width / 2, cy = y + height / 2;
  for (const [dx, dy] of [
    [-width / 2, -height / 2], [width / 2, -height / 2],
    [width / 2, height / 2], [-width / 2, height / 2],
  ]) extend(bounds, cx + c * dx - s * dy, cy + s * dx + c * dy);
}

function extendVector(bounds: PdfBounds, ops: readonly PdfVectorOp[], padding: number): void {
  for (const operation of ops) {
    if (operation.op === 'M' || operation.op === 'L') {
      extend(bounds, operation.x, operation.y, padding);
    } else if (operation.op === 'C') {
      // Control points conservatively contain the actual Bezier extrema.
      extend(bounds, operation.x1, operation.y1, padding);
      extend(bounds, operation.x2, operation.y2, padding);
      extend(bounds, operation.x, operation.y, padding);
    }
  }
}

/** Conservative paper-coordinate bbox for the commands that form the plan scene. */
export function pdfCommandBounds(commands: readonly PdfCommand[]): PdfBounds {
  const bounds = emptyPdfBounds();
  for (const command of commands) {
    if (command.kind === 'path') {
      const padding = command.stroke ? (command.width || 0.5) / 2 : 0;
      for (const ring of command.rings) for (const [x, y] of ring) extend(bounds, x, y, padding);
    } else if (command.kind === 'line') {
      for (const [x, y] of command.points) extend(bounds, x, y, command.width / 2);
    } else if (command.kind === 'vector') {
      extendVector(bounds, command.ops, command.width / 2);
    } else if (command.kind === 'text') {
      const text = pdfTextBounds(command);
      extend(bounds, text.minX, text.minY);
      extend(bounds, text.maxX, text.maxY);
    } else {
      extendRotatedRect(bounds, command.x, command.y, command.width, command.height,
        command.angle || 0);
    }
  }
  return bounds;
}

const translateVectorOperation = (operation: PdfVectorOp, dx: number, dy: number): PdfVectorOp => {
  if (operation.op === 'M' || operation.op === 'L') {
    return { ...operation, x: operation.x + dx, y: operation.y + dy };
  }
  if (operation.op === 'C') return {
    ...operation,
    x1: operation.x1 + dx, y1: operation.y1 + dy,
    x2: operation.x2 + dx, y2: operation.y2 + dy,
    x: operation.x + dx, y: operation.y + dy,
  };
  return operation;
};

/** Translate only plan-scene commands; page chrome is appended after this pass. */
export function translatePdfCommands(
  commands: readonly PdfCommand[], dx: number, dy: number,
): PdfCommand[] {
  return commands.map((command): PdfCommand => {
    if (command.kind === 'path') return {
      ...command,
      rings: command.rings.map((ring) => ring.map(([x, y]) => [x + dx, y + dy] as const)),
    };
    if (command.kind === 'line') return {
      ...command,
      points: command.points.map(([x, y]) => [x + dx, y + dy] as const),
    };
    if (command.kind === 'vector') return {
      ...command, ops: command.ops.map((operation) => translateVectorOperation(operation, dx, dy)),
    };
    return { ...command, x: command.x + dx, y: command.y + dy };
  });
}

export function pdfSceneFits(bounds: PdfBounds, field: PdfField, tolerance: number): boolean {
  if (!validPdfBounds(bounds)) return false;
  return pdfBoundsWidth(bounds) <= pdfBoundsWidth(field) + tolerance
    && pdfBoundsHeight(bounds) <= pdfBoundsHeight(field) + tolerance;
}

export function centerPdfScene(
  commands: readonly PdfCommand[], field: PdfField,
): { commands: PdfCommand[]; bounds: PdfBounds; dx: number; dy: number } {
  const before = pdfCommandBounds(commands);
  if (!validPdfBounds(before)) return { commands: [...commands], bounds: before, dx: 0, dy: 0 };
  const dx = (field.minX + field.maxX - before.minX - before.maxX) / 2;
  const dy = (field.minY + field.maxY - before.minY - before.maxY) / 2;
  const translated = translatePdfCommands(commands, dx, dy);
  return { commands: translated, bounds: {
    minX: before.minX + dx, minY: before.minY + dy,
    maxX: before.maxX + dx, maxY: before.maxY + dy,
  }, dx, dy };
}
