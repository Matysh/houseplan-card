/**
 * Conservative minifier for static Lit css`` templates.
 *
 * This deliberately is not a general CSS optimiser: it removes comments and
 * redundant whitespace while preserving strings, escapes and descendant
 * combinators.  Interpolated templates fail closed because rewriting across a
 * JavaScript expression would make the build depend on runtime values.
 */
const isWhitespace = (char) => /[\t\n\f\r ]/.test(char);
const TIGHT_BEFORE = new Set(['{', '}', ':', ';', ',', '>', ')']);
const TIGHT_AFTER = new Set(['{', '}', ':', ';', ',', '>', '(']);

export function minifyCssText(source, label = '<css>') {
  let out = '';
  let quote = '';
  let pendingSpace = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];

    if (quote) {
      out += char;
      if (char === '\\') {
        if (i + 1 >= source.length) throw new Error(`${label}: dangling CSS escape`);
        out += source[++i];
      } else if (char === quote) quote = '';
      continue;
    }

    if (char === '"' || char === "'") {
      if (pendingSpace && out && !TIGHT_AFTER.has(out.at(-1))) out += ' ';
      pendingSpace = false;
      quote = char;
      out += char;
      continue;
    }

    if (char === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      if (end < 0) throw new Error(`${label}: unclosed CSS comment`);
      i = end + 1;
      continue;
    }

    if (isWhitespace(char)) {
      pendingSpace = true;
      continue;
    }

    if (pendingSpace && out && !TIGHT_AFTER.has(out.at(-1)) && !TIGHT_BEFORE.has(char)) {
      out += ' ';
    }
    pendingSpace = false;
    if (TIGHT_BEFORE.has(char) && out.endsWith(' ')) out = out.slice(0, -1);
    out += char;
  }

  if (quote) throw new Error(`${label}: unclosed CSS string`);
  return out.trim();
}

export function minifyStaticCssTemplates(code, id = '<module>') {
  let cursor = 0;
  let output = '';
  let changed = false;
  while (true) {
    const start = code.indexOf('css`', cursor);
    if (start < 0) break;
    let end = start + 4;
    let escaped = false;
    for (; end < code.length; end += 1) {
      const char = code[end];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === '$' && code[end + 1] === '{') {
        throw new Error(`${id}:${end}: interpolated css template is not supported`);
      }
      if (char === '`') break;
    }
    if (end >= code.length) throw new Error(`${id}:${start}: unclosed css template`);
    const css = code.slice(start + 4, end);
    output += code.slice(cursor, start);
    output += `css\`${minifyCssText(css, `${id}:${start}`)}\``;
    cursor = end + 1;
    changed = true;
  }
  if (!changed) return null;
  return output + code.slice(cursor);
}

export function cssTemplateMinifier() {
  return {
    name: 'houseplan-css-template-minifier',
    transform(code, id) {
      if (!id.endsWith('.ts') || !code.includes('css`')) return null;
      const transformed = minifyStaticCssTemplates(code, id);
      return transformed == null ? null : { code: transformed, map: null };
    },
  };
}
