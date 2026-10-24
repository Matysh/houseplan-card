/** CSS lexical primitives shared by ownership, equivalence and orphan checks.
 * Offsets always address the original input, including comments and escapes. */
const space = c => !!c && /[ \t\n\r\f]/.test(c);
const hex = c => !!c && /[0-9a-f]/iu.test(c);
const nameChar = c => !!c && (/[a-z0-9_-]/i.test(c) || c.charCodeAt(0) >= 0x80);

function escapeAt(text, start) {
  let end = start + 1;
  if (hex(text[end])) {
    while (end < start + 7 && hex(text[end])) end++;
    const number = Number.parseInt(text.slice(start + 1, end), 16);
    const value = number && number <= 0x10ffff && !(number >= 0xd800 && number <= 0xdfff)
      ? String.fromCodePoint(number) : '\ufffd';
    if (space(text[end])) end += text[end] === '\r' && text[end + 1] === '\n' ? 2 : 1;
    return { end, value };
  }
  if (text[end] === '\r' || text[end] === '\n' || text[end] === '\f')
    return { end: end + (text[end] === '\r' && text[end + 1] === '\n' ? 2 : 1), value: '' };
  return { end: Math.min(text.length, end + 1), value: text[end] || '\ufffd' };
}

export function cssTokens(text) {
  const tokens = [];
  for (let i = 0; i < text.length;) {
    const start = i, c = text[i];
    if (text.startsWith('/*', i)) {
      const close = text.indexOf('*/', i + 2);
      i = close < 0 ? text.length : close + 2;
      tokens.push({ kind: 'comment', start, end: i, value: ' ' });
    } else if (space(c)) {
      while (space(text[++i]));
      tokens.push({ kind: 'space', start, end: i, value: ' ' });
    } else if (c === '"' || c === "'") {
      let value = '';
      i++;
      while (i < text.length && text[i] !== c) {
        if (text[i] === '\\') { const esc = escapeAt(text, i); value += esc.value; i = esc.end; }
        else value += text[i++];
      }
      if (i < text.length) i++;
      tokens.push({ kind: 'string', start, end: i, value });
    } else if (nameChar(c) || c === '\\') {
      let value = '';
      while (i < text.length && (nameChar(text[i]) || text[i] === '\\')) {
        if (text[i] === '\\') { const esc = escapeAt(text, i); value += esc.value; i = esc.end; }
        else value += text[i++];
      }
      tokens.push({ kind: 'name', start, end: i, value });
    } else { i++; tokens.push({ kind: c, start, end: i, value: c }); }
  }
  return tokens;
}

export function normalizeCss(text) {
  let result = '', pending = false;
  for (const t of cssTokens(text)) {
    if (t.kind === 'comment' || t.kind === 'space') pending = true;
    else {
      if (pending && result) result += ' ';
      result += text.slice(t.start, t.end); pending = false;
    }
  }
  return result;
}

/** Split only at lexical top level: attribute strings, escaped commas and
 * function arguments are indivisible. A CSS string's whitespace is preserved. */
export function splitCssFragments(text, separator) {
  const parts = []; let from = 0, round = 0, square = 0, curly = 0;
  for (const t of cssTokens(text)) {
    if (t.kind === '(') round++;
    else if (t.kind === ')') round--;
    else if (!round && t.kind === '[') square++;
    else if (!round && t.kind === ']') square--;
    else if (!round && !square && t.kind === '{') curly++;
    else if (!round && !square && t.kind === '}') curly--;
    else if (t.kind === separator && round === 0 && square === 0 && curly === 0) {
      parts.push(text.slice(from, t.start)); from = t.end;
    }
  }
  parts.push(text.slice(from));
  return parts;
}
export const splitCss = (text, separator) => splitCssFragments(text, separator).map(normalizeCss).filter(Boolean);
export const splitSelectors = text => splitCss(text, ',');

/** Definitions include wrappers and keyframes; parseRules below projects the
 * historical leaf API. Keyframe steps are deliberately not class selectors. */
export function parseCss(text) {
  const tokens = cssTokens(text), records = [];
  const significant = i => tokens[i] && !['space', 'comment'].includes(tokens[i].kind);
  const walk = (first, last, scope, inKeyframes = false) => {
    let i = first;
    while (i < last) {
      while (i < last && !significant(i)) i++;
      if (i >= last) break;
      const begin = i; let round = 0, square = 0;
      for (; i < last; i++) {
        const k = tokens[i].kind;
        if (k === '(') round++;
        else if (k === ')') round--;
        else if (k === '[') square++;
        else if (k === ']') square--;
        else if (!round && !square && (k === '{' || k === ';')) break;
      }
      if (i >= last) throw Error(`Unsupported CSS trailing text at offset ${tokens[begin].start}`);
      if (tokens[i].kind === ';') {
        if (tokens[begin].kind !== '@') throw Error(`Unsupported CSS statement at offset ${tokens[begin].start}`);
        i++; continue;
      }
      const open = i; let depth = 1, bodyRound = 0, bodySquare = 0;
      for (i++; i < last && depth; i++) {
        const kind = tokens[i].kind;
        if (kind === '(') bodyRound++;
        else if (kind === ')') bodyRound--;
        else if (!bodyRound && kind === '[') bodySquare++;
        else if (!bodyRound && kind === ']') bodySquare--;
        else if (!bodyRound && !bodySquare && kind === '{') depth++;
        else if (!bodyRound && !bodySquare && kind === '}') depth--;
      }
      if (depth) throw Error(`Unclosed CSS block at offset ${tokens[open].start}`);
      const close = i - 1;
      const header = normalizeCss(text.slice(tokens[begin].start, tokens[open].start));
      const body = text.slice(tokens[open].end, tokens[close].start);
      const keyframe = /^@(?:-\w+-)?keyframes\s+/i.test(header);
      const wrapper = header.startsWith('@') && !keyframe
        && /^@(media|supports|container|layer|scope|starting-style|document)\b/i.test(header);
      const record = { scope: [...scope], header, selectors: header.startsWith('@') ? [] : splitSelectors(header),
        declarations: wrapper || keyframe ? [] : splitCss(body, ';'),
        start: tokens[begin].start, end: tokens[close].end,
        bodyStart: tokens[open].end, bodyEnd: tokens[close].start,
        kind: keyframe ? 'keyframes' : wrapper ? 'wrapper' : inKeyframes ? 'keyframe-step' : header.startsWith('@') ? 'at-rule' : 'rule' };
      if (!wrapper && !keyframe) {
        let round = 0, square = 0, customDepth = 0, declarationStart = tokens[open].end;
        for (let part = open + 1; part < close; part++) {
          const token = tokens[part];
          if (token.kind === '(') round++;
          else if (token.kind === ')') round--;
          else if (!round && token.kind === '[') square++;
          else if (!round && token.kind === ']') square--;
          else if (!round && !square && token.kind === '{') {
            if (!customDepth && !/^\s*--[-\w]+\s*:/.test(text.slice(declarationStart, token.start)))
              throw Error(`Unsupported CSS nesting at offset ${token.start}; nested selectors cannot be treated as declarations`);
            customDepth++;
          } else if (token.kind === '}' && customDepth) customDepth--;
          else if (token.kind === ';' && !round && !square && !customDepth) declarationStart = token.end;
        }
      }
      if (keyframe) record.name = cssTokens(header).filter(t => t.kind === 'name' || t.kind === 'string').at(-1)?.value;
      records.push(record);
      if (wrapper || keyframe) walk(open + 1, close, [...scope, header], keyframe || inKeyframes);
    }
  };
  walk(0, tokens.length, []);
  return records;
}
export const parseRules = text => parseCss(text).filter(r => ['rule', 'keyframe-step', 'at-rule'].includes(r.kind));

/** Positive and negative occurrences stay separate. Branches are diagnostics,
 * never a claim that an entire selector/rule cannot match. */
export function selectorClasses(selector) {
  const tokens = cssTokens(selector), result = [];
  const walk = (from, to, positive, branch) => {
    let square = 0;
    for (let i = from; i < to; i++) {
      const t = tokens[i];
      if (t.kind === '[') { square++; continue; }
      if (t.kind === ']') { square--; continue; }
      if (square || t.kind === 'string' || t.kind === 'comment') continue;
      if (t.kind === ':' && tokens[i + 1]?.kind === 'name' && tokens[i + 2]?.kind === '(') {
        const fn = tokens[i + 1].value.toLowerCase(); let end = i + 3, depth = 1;
        for (; end < to && depth; end++) {
          if (tokens[end].kind === '(') depth++;
          else if (tokens[end].kind === ')') depth--;
        }
        walk(i + 3, end - 1, fn === 'not' ? !positive : positive, [...branch, `${fn}@${t.start}`]);
        i = end - 1;
      } else if (t.kind === '.' && tokens[i + 1]?.kind === 'name' && tokens[i + 1].start === t.end) {
        const next = tokens[i + 1];
        // Decimal dimensions are not class identifiers. Escaped digits are legal.
        if (!/^\d/.test(selector.slice(next.start, next.end)))
          result.push({ name: next.value, positive, branch: [...branch], start: t.start, end: next.end });
      }
    }
  };
  walk(0, tokens.length, true, []);
  return result;
}
export const classesOf = selector => selectorClasses(selector).map(c => c.name);
