import {
  PDF_FONT_ASCENT, PDF_FONT_BASE64, PDF_FONT_BBOX, PDF_FONT_DESCENT,
  PDF_FONT_GLYPHS, PDF_FONT_UNITS_PER_EM, PDF_FONT_WIDTHS,
} from './pdf-font.generated';
import type { PdfVectorOp } from './svg-path';

export type PdfColor = readonly [number, number, number];

export type PdfCommand =
  | { kind: 'path'; rings: readonly (readonly (readonly [number, number])[])[];
      fill?: PdfColor; stroke?: PdfColor; width?: number; dash?: readonly number[] }
  | { kind: 'line'; points: readonly (readonly [number, number])[];
      stroke: PdfColor; width: number; dash?: readonly number[] }
  | { kind: 'vector'; ops: readonly PdfVectorOp[]; stroke: PdfColor; width: number }
  | { kind: 'text'; x: number; y: number; text: string; size: number;
      color?: PdfColor; angle?: number; align?: 'left' | 'center' | 'right' }
  | { kind: 'image'; imageId: string; x: number; y: number; width: number; height: number;
      opacity?: number; angle?: number };

export interface PdfJpegImage {
  id: string;
  bytes: Uint8Array;
  width: number;
  height: number;
}

export interface PdfPage {
  width: number;
  height: number;
  commands: readonly PdfCommand[];
  images?: readonly PdfJpegImage[];
  now: Date;
}

const encoder = new TextEncoder();
const fmt = (value: number): string => {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, '');
};
const color = (value: PdfColor): string => value.map(fmt).join(' ');

function base64Bytes(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function glyphsFor(text: string): { hex: string; width: number; unicode: Map<number, number> } {
  let hex = '';
  let width = 0;
  const unicode = new Map<number, number>();
  for (const char of text) {
    const code = char.codePointAt(0) || 0;
    const glyph = PDF_FONT_GLYPHS[code] || PDF_FONT_GLYPHS[0x3f] || 0;
    hex += glyph.toString(16).padStart(4, '0');
    width += PDF_FONT_WIDTHS[glyph] || PDF_FONT_UNITS_PER_EM * 0.5;
    if (!unicode.has(glyph)) unicode.set(glyph, code || 0x3f);
  }
  return { hex, width, unicode };
}

export function measurePdfText(text: string, size: number): number {
  return glyphsFor(text).width * size / PDF_FONT_UNITS_PER_EM;
}

function toUnicodeCMap(map: ReadonlyMap<number, number>): string {
  const entries = [...map].sort((a, b) => a[0] - b[0]);
  const lines = entries.map(([glyph, code]) => {
    const source = glyph.toString(16).padStart(4, '0');
    const target = code <= 0xffff
      ? code.toString(16).padStart(4, '0')
      : (() => {
          const n = code - 0x10000;
          return (0xd800 + (n >> 10)).toString(16).padStart(4, '0')
            + (0xdc00 + (n & 0x3ff)).toString(16).padStart(4, '0');
        })();
    return `<${source}> <${target}>`;
  });
  return `/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n`
    + `/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n`
    + `/CMapName /HousePlanUnicode def\n/CMapType 2 def\n1 begincodespacerange\n`
    + `<0000> <FFFF>\nendcodespacerange\n${entries.length} beginbfchar\n`
    + `${lines.join('\n')}\nendbfchar\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend`;
}

function contentStream(
  page: PdfPage, opacityNames: ReadonlyMap<number, string>,
): { stream: string; unicode: Map<number, number> } {
  const out: string[] = [];
  const unicode = new Map<number, number>();
  const y = (value: number): number => page.height - value;
  const numericOperator = (operator: string, ...values: number[]): string =>
    `${values.map(fmt).join(' ')} ${operator}`;
  const emitPath = (rings: readonly (readonly (readonly [number, number])[])[]): void => {
    for (const ring of rings) {
      if (!ring.length) continue;
      out.push(numericOperator('m', ring[0][0], y(ring[0][1])));
      for (let i = 1; i < ring.length; i++) {
        out.push(`${fmt(ring[i][0])} ${fmt(y(ring[i][1]))} l`);
      }
      out.push('h');
    }
  };
  for (const command of page.commands) {
    if (command.kind === 'path') {
      out.push('q');
      if (command.fill) out.push(`${color(command.fill)} rg`);
      if (command.stroke) out.push(`${color(command.stroke)} RG ${fmt(command.width || 0.5)} w`);
      if (command.dash) out.push(`[${command.dash.map(fmt).join(' ')}] 0 d`);
      emitPath(command.rings);
      out.push(command.fill && command.stroke ? 'B*' : command.fill ? 'f*' : 'S', 'Q');
    } else if (command.kind === 'line') {
      if (command.points.length < 2) continue;
      out.push('q', `${color(command.stroke)} RG ${fmt(command.width)} w`);
      if (command.dash) out.push(`[${command.dash.map(fmt).join(' ')}] 0 d`);
      out.push(numericOperator('m', command.points[0][0], y(command.points[0][1])));
      for (let i = 1; i < command.points.length; i++) {
        out.push(`${fmt(command.points[i][0])} ${fmt(y(command.points[i][1]))} l`);
      }
      out.push('S', 'Q');
    } else if (command.kind === 'vector') {
      out.push('q', `${color(command.stroke)} RG ${fmt(command.width)} w`, '1 J 1 j');
      for (const entry of command.ops) {
        if (entry.op === 'M' || entry.op === 'L') {
          out.push(`${fmt(entry.x)} ${fmt(y(entry.y))} ${entry.op === 'M' ? 'm' : 'l'}`);
        } else if (entry.op === 'C') {
          out.push(`${fmt(entry.x1)} ${fmt(y(entry.y1))} ${fmt(entry.x2)} ${fmt(y(entry.y2))} ${fmt(entry.x)} ${fmt(y(entry.y))} c`);
        } else out.push('h');
      }
      out.push('S', 'Q');
    } else if (command.kind === 'text') {
      const encoded = glyphsFor(command.text);
      for (const [glyph, code] of encoded.unicode) if (!unicode.has(glyph)) unicode.set(glyph, code);
      const align = command.align || 'left';
      const shift = align === 'center' ? encoded.width * command.size / PDF_FONT_UNITS_PER_EM / 2
        : align === 'right' ? encoded.width * command.size / PDF_FONT_UNITS_PER_EM : 0;
      const angle = (command.angle || 0) * Math.PI / 180;
      const c = Math.cos(angle), s = Math.sin(angle);
      const tx = command.x - c * shift;
      const ty = y(command.y) + s * shift;
      out.push('BT', `${color(command.color || [0, 0, 0])} rg`, `/F1 ${fmt(command.size)} Tf`,
        `${fmt(c)} ${fmt(s)} ${fmt(-s)} ${fmt(c)} ${fmt(tx)} ${fmt(ty)} Tm`,
        `<${encoded.hex}> Tj`, 'ET');
    } else {
      const angle = (command.angle || 0) * Math.PI / 180;
      const c = Math.cos(angle), s = Math.sin(angle);
      const cx = command.x + command.width / 2, cy = y(command.y + command.height / 2);
      out.push('q');
      const opacity = command.opacity == null ? 1 : Math.max(0, Math.min(1, command.opacity));
      const opacityName = opacityNames.get(opacity);
      if (opacityName) out.push(`/${opacityName} gs`);
      out.push(numericOperator('cm', c * command.width, s * command.width,
        s * command.height, -c * command.height,
        cx - c * command.width / 2 - s * command.height / 2,
        cy - s * command.width / 2 + c * command.height / 2),
        `/Im${command.imageId} Do`, 'Q');
    }
  }
  return { stream: out.join('\n'), unicode };
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}

const textBytes = (value: string): Uint8Array => encoder.encode(value);
const streamObject = (dictionary: string, bytes: Uint8Array): Uint8Array => concat([
  textBytes(`<< ${dictionary} /Length ${bytes.length} >>\nstream\n`), bytes,
  textBytes('\nendstream'),
]);

/** Minimal deterministic PDF 1.4 writer used only by the lazy export graph. */
export function writePdf(page: PdfPage): Uint8Array {
  const font = base64Bytes(PDF_FONT_BASE64);
  const opacities = [...new Set(page.commands.flatMap((command) =>
    command.kind === 'image' && command.opacity != null && command.opacity < 1
      ? [Math.max(0, Math.min(1, command.opacity))] : []))].sort((a, b) => a - b);
  const opacityNames = new Map(opacities.map((opacity, index) => [opacity, `GS${index + 1}`]));
  const rendered = contentStream(page, opacityNames);
  const maxGlyph = Math.max(0, ...Object.keys(PDF_FONT_WIDTHS).map(Number));
  const widths = Array.from({ length: maxGlyph + 1 }, (_, glyph) =>
    Math.round((PDF_FONT_WIDTHS[glyph] || PDF_FONT_UNITS_PER_EM * 0.5) * 1000 / PDF_FONT_UNITS_PER_EM));
  const objects: Uint8Array[] = [];
  const add = (value: string | Uint8Array): number => {
    objects.push(typeof value === 'string' ? textBytes(value) : value);
    return objects.length;
  };
  const catalog = add('');
  const pages = add('');
  const pageObject = add('');
  const fontFile = add(streamObject(`/Length1 ${font.length}`, font));
  const descriptor = add(`<< /Type /FontDescriptor /FontName /Roboto /Flags 32 /FontBBox [${PDF_FONT_BBOX.join(' ')}] /ItalicAngle 0 /Ascent ${PDF_FONT_ASCENT} /Descent ${PDF_FONT_DESCENT} /CapHeight ${PDF_FONT_ASCENT} /StemV 80 /FontFile2 ${fontFile} 0 R >>`);
  const cidFont = add(`<< /Type /Font /Subtype /CIDFontType2 /BaseFont /Roboto /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${descriptor} 0 R /W [0 [${widths.join(' ')}]] /CIDToGIDMap /Identity >>`);
  const cmap = textBytes(toUnicodeCMap(rendered.unicode));
  const toUnicode = add(streamObject('', cmap));
  const type0 = add(`<< /Type /Font /Subtype /Type0 /BaseFont /Roboto /Encoding /Identity-H /DescendantFonts [${cidFont} 0 R] /ToUnicode ${toUnicode} 0 R >>`);
  const content = add(streamObject('', textBytes(rendered.stream)));
  const imageRefs: string[] = [];
  for (const image of page.images || []) {
    const ref = add(streamObject(`/Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`, image.bytes));
    imageRefs.push(`/Im${image.id} ${ref} 0 R`);
  }
  const date = page.now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const info = add(`<< /CreationDate (D:${date}Z) /ModDate (D:${date}Z) >>`);
  const resources = `<< /Font << /F1 ${type0} 0 R >>`
    + `${imageRefs.length ? ` /XObject << ${imageRefs.join(' ')} >>` : ''}`
    + `${opacities.length ? ` /ExtGState << ${opacities.map((opacity) =>
      `/${opacityNames.get(opacity)} << /ca ${fmt(opacity)} /CA ${fmt(opacity)} >>`).join(' ')} >>` : ''} >>`;
  objects[catalog - 1] = textBytes(`<< /Type /Catalog /Pages ${pages} 0 R >>`);
  objects[pages - 1] = textBytes(`<< /Type /Pages /Kids [${pageObject} 0 R] /Count 1 >>`);
  objects[pageObject - 1] = textBytes(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 ${fmt(page.width)} ${fmt(page.height)}] /Resources ${resources} /Contents ${content} 0 R >>`);

  const header = textBytes('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const body: Uint8Array[] = [header];
  const offsets = [0];
  let offset = header.length;
  objects.forEach((object, index) => {
    const prefix = textBytes(`${index + 1} 0 obj\n`);
    const suffix = textBytes('\nendobj\n');
    offsets.push(offset);
    body.push(prefix, object, suffix);
    offset += prefix.length + object.length + suffix.length;
  });
  const xrefOffset = offset;
  const xref = ['xref', `0 ${objects.length + 1}`, '0000000000 65535 f '];
  for (let i = 1; i <= objects.length; i++) xref.push(`${String(offsets[i]).padStart(10, '0')} 00000 n `);
  xref.push(`trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>`,
    `startxref\n${xrefOffset}\n%%EOF\n`);
  body.push(textBytes(xref.join('\n')));
  return concat(body);
}
