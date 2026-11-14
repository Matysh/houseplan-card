import ts from 'typescript';

const forbidden = new Set(['hass', 'callWS', 'callApi', 'callService', 'fetchWithAuth', 'auth']);
const memberName = node => ts.isPropertyAccessExpression(node) ? node.name.text
  : ts.isElementAccessExpression(node) && node.argumentExpression && ts.isStringLiteralLike(node.argumentExpression)
    ? node.argumentExpression.text : null;

/** Addressed source guard, not a claim that the entire HA application is portable. */
export function inspectPlanHostBoundary(text, { owners } = {}) {
  const source = ts.createSourceFile('boundary.ts', text, ts.ScriptTarget.Latest, true);
  const found = [], seen = new Set();
  const inspect = node => {
    let name = memberName(node);
    if (ts.isBindingElement(node)) name = node.propertyName?.getText(source).replace(/^['"]|['"]$/g, '')
      ?? (ts.isIdentifier(node.name) ? node.name.text : null);
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'Reflect.get'
        && node.arguments[1] && ts.isStringLiteralLike(node.arguments[1])) name = node.arguments[1].text;
    if (forbidden.has(name)) found.push({ line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
      field: name, source: node.getText(source) });
    ts.forEachChild(node, inspect);
  };
  if (!owners) inspect(source);
  else {
    const visit = node => {
      if ((ts.isMethodDeclaration(node) || ts.isGetAccessor(node) || ts.isSetAccessor(node)
          || ts.isFunctionDeclaration(node) || ts.isPropertyDeclaration(node)) && node.name) {
        const name = node.name.getText(source);
        if (owners.includes(name)) {
          seen.add(name);
          if (ts.isPropertyDeclaration(node)) { if (node.initializer) inspect(node.initializer); }
          else if (node.body) inspect(node.body);
          return;
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    for (const name of owners) if (!seen.has(name)) found.push({ line: 0, field: 'missing-owner', source: name });
  }
  return found;
}
