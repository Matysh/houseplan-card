import ts from 'typescript';

/** Read Lit markup without treating a `>` inside a JS binding as a tag end.
 * Offsets point at the original source; nested templates are visited separately.
 */
export function templateTags(source, file = 'source.ts') {
  const unit = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const tags = [];
  const visit = node => {
    if (ts.isTaggedTemplateExpression(node) && /^(html|svg)$/.test(node.tag.getText(unit))) {
      const template = node.template;
      const chunks = [], expressions = [];
      let flat = '';
      const literal = part => {
        const start = part.getStart(unit) + 1;
        const tail = ts.isNoSubstitutionTemplateLiteral(part) || ts.isTemplateTail(part);
        const text = source.slice(start, part.end - (tail ? 1 : 2));
        chunks.push({ start: flat.length, end: flat.length + text.length,
          source: start });
        flat += text;
      };
      if (ts.isNoSubstitutionTemplateLiteral(template)) literal(template);
      else {
        literal(template.head);
        for (const span of template.templateSpans) {
          const index = expressions.push(span.expression) - 1;
          flat += `HP_EXPR_${index}`;
          literal(span.literal);
        }
      }
      for (const match of flat.matchAll(/<([a-z][\w-]*)\b([^<>]*?)>/g)) {
        const chunk = chunks.find(part => match.index >= part.start && match.index < part.end);
        if (!chunk) continue;
        const attributes = new Map();
        for (const attr of match[2].matchAll(/([.?@]?[\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+)))?/g)) {
          const value = attr[2] ?? attr[3] ?? attr[4] ?? '';
          const binding = /^HP_EXPR_(\d+)$/.exec(value);
          attributes.set(attr[1], { text: value,
            expression: binding ? expressions[Number(binding[1])] : undefined });
        }
        tags.push({ name: match[1], attributes, markup: match[0],
          start: chunk.source + match.index - chunk.start, expressions });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(unit);
  return tags.sort((a, b) => a.start - b.start);
}

export function stringResults(expression, file = 'source.ts') {
  if (ts.isStringLiteralLike(expression)) return [expression.text];
  if (ts.isConditionalExpression(expression)) return [
    ...stringResults(expression.whenTrue, file), ...stringResults(expression.whenFalse, file),
  ];
  if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression)
      || ts.isNonNullExpression(expression) || ts.isSatisfiesExpression(expression)) {
    return stringResults(expression.expression, file);
  }
  if (ts.isIdentifier(expression) && expression.text === 'nothing') return [];
  throw new Error(`Unsupported dynamic contract expression in ${file}: ${expression.getText()}`);
}

export function templateAttributeValues(source, attribute, file = 'source.ts', resolveDynamic) {
  const found = new Set();
  for (const tag of templateTags(source, file)) {
    const attr = tag.attributes.get(attribute);
    if (!attr) continue;
    for (const value of attr.expression
      ? resolveDynamic?.(attr.expression, file) ?? stringResults(attr.expression, file)
      : [attr.text]) found.add(value);
  }
  // DOM writers are syntax too: a new dynamic setAttribute/dataset assignment
  // must fail closed rather than silently disappearing from the inventory.
  const dataset = attribute.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  const unit = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const include = expression => {
    for (const value of resolveDynamic?.(expression, file) ?? stringResults(expression, file)) found.add(value);
  };
  const propertyName = node => ts.isPropertyAccessExpression(node) ? node.name.text
    : ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)
      ? node.argumentExpression.text : null;
  const visit = node => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
        && node.expression.name.text === 'setAttribute' && node.arguments.length >= 2
        && ts.isStringLiteralLike(node.arguments[0]) && node.arguments[0].text === attribute) include(node.arguments[1]);
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && propertyName(node.left) === dataset && propertyName(node.left.expression) === 'dataset') include(node.right);
    // Plain strings used with innerHTML are literal markup too. Selectors and
    // comments are not markup, and tagged Lit fragments were handled above.
    if (ts.isStringLiteralLike(node) && !ts.isTaggedTemplateExpression(node.parent)
        && /<[a-z]/.test(node.text)) {
      const literal = new RegExp('\\b' + attribute + '\\s*=\\s*["\']([^"\']+)["\']', 'g');
      for (const match of node.text.matchAll(literal)) found.add(match[1]);
    }
    ts.forEachChild(node, visit);
  };
  visit(unit);
  return found;
}

/** The only three dynamic tool writers consume these existing, closed menus.
 * Read their source definitions, never the contract being validated. Adding an
 * expression elsewhere must first teach this reader where its values originate.
 */
export function toolVocabularyFromSources(sourceByFile) {
  const values = new Set();
  const methods = new Map([
    ['houseplan-card.ts', ['_editorToolbarGroups']],
    ['houseplan-editor-runtime.ts', ['_shapesToolbarGroup', '_roomsToolbarGroup', '_renderDecorBar']],
    ['stairs-editor.ts', ['toolbarGroup']],
  ]);
  for (const [file, names] of methods) {
    const source = sourceByFile.get(file);
    if (!source) throw new Error(`Missing tool source ${file}`);
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const seen = new Set();
    const collect = node => {
      if (ts.isPropertyAssignment(node) && node.name.getText(tree) === 'id'
          && ts.isStringLiteralLike(node.initializer)) values.add(node.initializer.text);
      if (ts.isArrayLiteralExpression(node) && node.elements.length >= 2
          && ts.isStringLiteralLike(node.elements[0]) && ts.isStringLiteralLike(node.elements[1])
          && /^(mdi:|markup\.|decor\.|btn\.)/.test(node.elements[1].text)) values.add(node.elements[0].text);
      ts.forEachChild(node, collect);
    };
    const visit = node => {
      if ((ts.isMethodDeclaration(node) || ts.isGetAccessorDeclaration(node))
          && names.includes(node.name.getText(tree))) {
        seen.add(node.name.getText(tree)); collect(node.body);
      } else ts.forEachChild(node, visit);
    };
    visit(tree);
    for (const name of names) if (!seen.has(name)) throw new Error(`Missing tool menu ${file}:${name}`);
  }
  return [...values].map(value => value === 'delroom' ? 'delete-room' : value);
}

export function resolveToolExpression(expression, file, vocabulary) {
  const key = expression.getText().replace(/\s+/g, '');
  if (file === 'editor-secondary.ts'
      && ['group.id', "item.id==='delroom'?'delete-room':item.id"].includes(key)) return vocabulary;
  if (file === 'houseplan-editor-runtime.ts' && key === 't') return vocabulary;
  return stringResults(expression, file);
}

export const FORM_CONTROL_ELEMENTS = new Set([
  'input', 'select', 'textarea', 'ha-switch', 'ha-slider', 'ha-icon-picker', 'hp-color-opacity',
]);

/** Source coverage complements runtime input/lifecycle proofs. It deliberately
 * does not assert visibility, identity values or user-action success. */
export function missingControlHooks(source, file) {
  const errors = [];
  for (const tag of templateTags(source, file)) {
    if (!FORM_CONTROL_ELEMENTS.has(tag.name)) continue;
    const hook = tag.attributes.get('data-hp');
    if (!hook || hook.expression || !['field', 'image-upload', 'device-catalog-select', 'device-catalog-select-all'].includes(hook.text)) {
      errors.push(`${file}:${source.slice(0, tag.start).split('\n').length}: ${tag.name} lacks a control hook`);
      continue;
    }
    if (hook.text === 'field') {
      const identity = tag.attributes.get('data-field');
      if (!identity || (!identity.expression && !/^[a-z][a-zA-Z0-9-]*$/.test(identity.text))) {
        errors.push(`${file}:${source.slice(0, tag.start).split('\n').length}: field lacks stable identity`);
      }
    }
  }
  return errors;
}
