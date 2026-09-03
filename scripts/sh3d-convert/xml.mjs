/**
 * Минимальный читатель XML для `Home.xml` из `.sh3d` (#446).
 *
 * Почему свой, а не библиотека. Инструмент собирается без зависимостей: в
 * браузере он должен грузиться как обычный модуль, а в Node — исполняться в
 * CI без установки чего-либо. `Home.xml` машинно сгенерирован и предсказуем:
 * элементы, атрибуты, текст, без namespace'ов.
 *
 * Безопасность важнее полноты. Файл приходит от постороннего, поэтому:
 * `<!DOCTYPE>` пропускается и НЕ разрешается (Sweet Home 3D ссылается на свою
 * DTD, и попытка её загрузить — это XXE), объявления сущностей отвергаются,
 * из ссылок понимаются только пять предопределённых и числовые. Глубина и
 * число узлов ограничены: zip-бомба и «миллион смешков» не должны вешать
 * вкладку.
 */

const PREDEFINED = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

export class XmlError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

/** Раскрытие ссылок: только предопределённые и числовые, всё прочее — отказ. */
export function decodeText(raw) {
  return String(raw).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (whole, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X'
        ? Number.parseInt(body.slice(2), 16)
        : Number.parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) {
        throw new XmlError('bad_reference', `Недопустимая ссылка: ${whole}`);
      }
      return String.fromCodePoint(code);
    }
    if (body in PREDEFINED) return PREDEFINED[body];
    // Своя сущность — это либо DTD, либо расширение: то и другое мы не берём.
    throw new XmlError('entity_reference', `Сущность ${whole} не поддерживается`);
  });
}

const LIMITS = { maxNodes: 400_000, maxDepth: 64, maxAttrChars: 65_536 };

/**
 * Разобрать документ в дерево `{ tag, attrs, children }`.
 *
 * Текст элементов не нужен ни одному полю `.sh3d`, которое мы читаем, поэтому
 * он не собирается — это осознанное сужение, а не забывчивость.
 */
export function parseXml(source, limits = LIMITS) {
  const text = String(source);
  if (text.includes('<!ENTITY')) {
    throw new XmlError('entity_declaration', 'Объявления сущностей запрещены');
  }
  const root = { tag: '#document', attrs: {}, children: [] };
  const stack = [root];
  let nodes = 0;
  let at = 0;
  while (at < text.length) {
    const open = text.indexOf('<', at);
    if (open < 0) break;
    at = open;
    if (text.startsWith('<!--', at)) {
      const end = text.indexOf('-->', at + 4);
      if (end < 0) throw new XmlError('unterminated', 'Незакрытый комментарий');
      at = end + 3;
      continue;
    }
    if (text.startsWith('<?', at)) {
      const end = text.indexOf('?>', at + 2);
      if (end < 0) throw new XmlError('unterminated', 'Незакрытая инструкция');
      at = end + 2;
      continue;
    }
    if (text.startsWith('<![CDATA[', at)) {
      const end = text.indexOf(']]>', at + 9);
      if (end < 0) throw new XmlError('unterminated', 'Незакрытый CDATA');
      at = end + 3;
      continue;
    }
    if (text.startsWith('<!DOCTYPE', at)) {
      // Пропускаем, ничего не загружая. Внутренний блок [...] допустим только
      // без объявлений сущностей — это проверено выше по всему тексту.
      let depth = 0;
      let cursor = at + 9;
      for (; cursor < text.length; cursor++) {
        const ch = text[cursor];
        if (ch === '[') depth++;
        else if (ch === ']') depth--;
        else if (ch === '>' && depth <= 0) break;
      }
      if (cursor >= text.length) throw new XmlError('unterminated', 'Незакрытый DOCTYPE');
      at = cursor + 1;
      continue;
    }
    if (text.startsWith('</', at)) {
      const end = text.indexOf('>', at + 2);
      if (end < 0) throw new XmlError('unterminated', 'Незакрытый закрывающий тег');
      const name = text.slice(at + 2, end).trim();
      const top = stack[stack.length - 1];
      if (stack.length < 2 || top.tag !== name) {
        throw new XmlError('mismatched_tag', `Тег ${name} закрыт не там, где открыт`);
      }
      stack.pop();
      at = end + 1;
      continue;
    }
    // Открывающий тег: имя, атрибуты, возможный самозакрывающий слэш.
    const end = findTagEnd(text, at);
    const body = text.slice(at + 1, end);
    const selfClosing = body.endsWith('/');
    const inner = selfClosing ? body.slice(0, -1) : body;
    const match = /^([^\s/>]+)([\s\S]*)$/.exec(inner);
    if (!match) throw new XmlError('bad_tag', 'Не разобран открывающий тег');
    if (++nodes > limits.maxNodes) throw new XmlError('too_many_nodes', 'Слишком много узлов');
    const node = { tag: match[1], attrs: parseAttrs(match[2], limits), children: [] };
    stack[stack.length - 1].children.push(node);
    if (!selfClosing) {
      stack.push(node);
      if (stack.length > limits.maxDepth) throw new XmlError('too_deep', 'Слишком глубоко');
    }
    at = end + 1;
  }
  if (stack.length !== 1) throw new XmlError('unterminated', 'Документ закончился внутри элемента');
  const element = root.children.find((child) => child.tag[0] !== '#');
  if (!element) throw new XmlError('empty', 'В документе нет корневого элемента');
  return element;
}

/** Конец тега с учётом `>` внутри значений атрибутов. */
function findTagEnd(text, from) {
  let quote = '';
  for (let at = from + 1; at < text.length; at++) {
    const ch = text[at];
    if (quote) {
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '>') return at;
  }
  throw new XmlError('unterminated', 'Незакрытый тег');
}

function parseAttrs(source, limits) {
  const attrs = {};
  if (source.length > limits.maxAttrChars) {
    throw new XmlError('attrs_too_large', 'Атрибуты элемента превышают предел');
  }
  const re = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let match = re.exec(source);
  while (match) {
    attrs[match[1]] = decodeText(match[3] !== undefined ? match[3] : match[4]);
    match = re.exec(source);
  }
  return attrs;
}

/** Все дочерние элементы с указанным тегом (на один уровень). */
export const childrenOf = (node, tag) =>
  (node?.children || []).filter((child) => child.tag === tag);
