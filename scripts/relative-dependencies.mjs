// Static dependency discovery shared by the input graph and workflow sandboxes
// (#812). This is a lexical scanner, not a JS evaluator or module resolver:
// expressions/computed paths are never executed or guessed.

const IDENT_START = /[\p{ID_Start}_$]/u;
const IDENT_PART = /[\p{ID_Continue}_$]/u;
const REGEX_PREFIX = new Set(['return', 'throw', 'case', 'delete', 'void', 'typeof', 'new', 'yield', 'await', 'else', 'do', 'in', 'of']);
const CONTROL = new Set(['if', 'while', 'for', 'with', 'switch', 'catch']);

/** Tokens retain offsets; comments are blanked, not deleted (no token joins). */
export function scanJavaScript(text) {
  const tokens = [];
  const comments = [];
  let i = 0;
  const token = (kind, start, value = text.slice(start, i)) => tokens.push({ kind, value, start, end: i });
  const quoted = (quote) => {
    const start = i++;
    let value = '';
    while (i < text.length) {
      const ch = text[i++];
      if (ch === quote) break;
      if (ch !== '\\') { value += ch; continue; }
      const escaped = text[i++];
      if (escaped === '\n') continue;
      if (escaped === '\r') { if (text[i] === '\n') i += 1; continue; }
      const hex = escaped === 'x' ? /^[0-9a-f]{2}/i.exec(text.slice(i))
        : escaped === 'u' ? /^(?:[0-9a-f]{4}|\{[0-9a-f]+\})/i.exec(text.slice(i)) : null;
      if (hex) {
        const code = Number.parseInt(hex[0].replace(/[{}]/g, ''), 16);
        value += code <= 0x10ffff ? String.fromCodePoint(code) : '';
        i += hex[0].length;
      } else value += ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', 0: '\0' })[escaped] ?? escaped ?? '';
    }
    token('string', start, value);
  };
  const regexp = () => {
    const start = i++;
    let inClass = false;
    while (i < text.length) {
      const ch = text[i++];
      if (ch === '\\') { i += 1; continue; }
      if (ch === '[') inClass = true;
      if (ch === ']') inClass = false;
      if (ch === '/' && !inClass) break;
      if (ch === '\n' || ch === '\r') break;
    }
    while (i < text.length && /[a-z]/i.test(text[i])) i += 1;
    token('regex', start);
  };
  const template = () => {
    let start = i++;
    while (i < text.length) {
      if (text[i] === '\\') { i += 2; continue; }
      if (text[i] === '`') { i += 1; token('template', start); return; }
      if (text[i] === '$' && text[i + 1] === '{') {
        i += 2;
        token('template', start); // raw text cannot become import tokens
        code(true);
        start = i;
      } else i += 1;
    }
    token('template', start);
  };
  const code = (interpolation = false) => {
    let braces = 0;
    let regexAllowed = true;
    const parens = [];
    while (i < text.length) {
      const ch = text[i];
      if (/\s/.test(ch)) { i += 1; continue; }
      const start = i;
      if ((i === 0 && text.startsWith('#!')) || (ch === '/' && text[i + 1] === '/')) {
        while (i < text.length && text[i] !== '\n' && text[i] !== '\r') i += 1;
        comments.push([start, i]); continue;
      }
      if (ch === '/' && text[i + 1] === '*') {
        const end = text.indexOf('*/', i + 2);
        i = end < 0 ? text.length : end + 2;
        comments.push([start, i]); continue;
      }
      if (ch === '"' || ch === "'") { quoted(ch); regexAllowed = false; continue; }
      if (ch === '`') { template(); regexAllowed = false; continue; }
      if (ch === '/' && regexAllowed) { regexp(); regexAllowed = false; continue; }
      if (IDENT_START.test(ch)) {
        i += 1;
        while (i < text.length && IDENT_PART.test(text[i])) i += 1;
        token('identifier', start);
        regexAllowed = REGEX_PREFIX.has(tokens.at(-1).value);
        continue;
      }
      if (/[0-9]/.test(ch)) {
        i += 1;
        while (i < text.length && /[\w.]/.test(text[i])) i += 1;
        token('number', start); regexAllowed = false; continue;
      }
      if (ch === '}' && interpolation && braces === 0) {
        i += 1; token('punctuation', start); return;
      }
      if (ch === '(') parens.push(CONTROL.has(tokens.at(-1)?.value));
      if (ch === '{') braces += 1;
      if (ch === '}') braces -= 1;
      // A slash after a control header starts a regexp; after a call it is
      // division. ++/-- also finish an expression instead of starting one.
      regexAllowed = ch === ')' ? Boolean(parens.pop()) : ![']', '}', '.'].includes(ch);
      i += 1;
      if ((ch === '+' || ch === '-') && text[i] === ch) { i += 1; regexAllowed = false; }
      token('punctuation', start);
    }
  };
  code();
  let end = 0;
  const pieces = [];
  for (const [start, after] of comments) {
    pieces.push(text.slice(end, start), text.slice(start, after).replace(/[^\r\n]/g, ' '));
    end = after;
  }
  pieces.push(text.slice(end));
  return { tokens, withoutComments: pieces.join('') };
}

/** Literal relative import/re-export/require and script URL edges only. */
export function relativeDependencies(text, scanned = scanJavaScript(text)) {
  const { tokens } = scanned;
  const specs = new Set();
  const add = (token) => {
    if (token?.kind === 'string' && /^\.\.?\//.test(token.value)) specs.add(token.value);
  };
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (t.kind !== 'identifier' || tokens[i - 1]?.value === '.') continue;
    const next = tokens[i + 1];
    if ((t.value === 'import' || t.value === 'require') && next?.value === '(') {
      if ([')', ','].includes(tokens[i + 3]?.value)) add(tokens[i + 2]);
    } else if (t.value === 'import' || t.value === 'export') {
      if (next?.kind === 'string') { if (t.value === 'import') add(next); continue; }
      if (next?.value === '.') continue; // import.meta, not a declaration
      for (let j = i + 1; j < tokens.length; j += 1) {
        if ([';', '(', ')', '=', 'import', 'export'].includes(tokens[j].value)) break;
        if (tokens[j].value === 'from' && tokens[j + 1]?.kind === 'string') { add(tokens[j + 1]); break; }
      }
    } else if (t.value === 'new' && next?.value === 'URL') {
      const tail = tokens.slice(i + 2, i + 12);
      if (tail[0]?.value === '(' && tail[1]?.kind === 'string'
        && /\.(?:mjs|cjs|js)$/.test(tail[1].value)
        && tail.slice(2, 9).map((item) => item.value).join(' ') === ', import . meta . url )') add(tail[1]);
    }
  }
  return [...specs];
}
