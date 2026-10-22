import ts from 'typescript';

const sinkNames = new Set(['_showToast', '_toast', 'showToast', 'toast']);
const translators = new Map([['_t', 0], ['t', 0], ['text', 0], ['inboxT', 1],
  ['supportT', 1], ['settingsT', 1], ['toolsT', 1]]);
const unwrap = node => node && (ts.isParenthesizedExpression(node) || ts.isAsExpression(node)
  || ts.isSatisfiesExpression(node) || ts.isNonNullExpression(node)) ? unwrap(node.expression) : node;
const callName = node => ts.isIdentifier(node) ? node.text
  : ts.isPropertyAccessExpression(node) ? node.name.text : undefined;

function constant(reference) {
  if (!ts.isIdentifier(reference)) return;
  for (let scope = reference.parent; scope; scope = scope.parent) {
    if (ts.isFunctionLike(scope) && scope.parameters.some(p => p.name.getText() === reference.text)) return;
    if (!ts.isBlock(scope) && !ts.isSourceFile(scope)) continue;
    for (const statement of scope.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (declaration.name.getText() !== reference.text) continue;
        return statement.declarationList.flags & ts.NodeFlags.Const ? declaration.initializer : undefined;
      }
    }
  }
}

/** Carry the key of a single translation, never infer it from its result text. */
export function translatedToastKey(raw, seen = new Set()) {
  const node = unwrap(raw);
  if (!node || seen.has(node)) return;
  seen = new Set([...seen, node]);
  if (ts.isCallExpression(node)) {
    const index = translators.get(callName(node.expression));
    if (index !== undefined) return node.arguments[index];
  }
  if (ts.isConditionalExpression(node)) {
    const yes = translatedToastKey(node.whenTrue, seen), no = translatedToastKey(node.whenFalse, seen);
    if (yes || no) return { choice: true, condition: node.condition, yes, no };
  }
  if (ts.isIdentifier(node)) return translatedToastKey(constant(node), seen);
}

export function toastKeyText(key) {
  if (!key) return "'message'";
  if (key.choice) return `(${key.condition.getText()}) ? (${toastKeyText(key.yes)}) : (${toastKeyText(key.no)})`;
  return key.getText();
}

function fingerprint(raw) {
  if (!raw) return ['string', 'message'];
  if (raw.choice) return ['conditional', fingerprint(raw.condition), fingerprint(raw.yes), fingerprint(raw.no)];
  const node = unwrap(raw);
  if (ts.isStringLiteralLike(node)) return ['string', node.text];
  if (ts.isConditionalExpression(node)) return ['conditional', fingerprint(node.condition), fingerprint(node.whenTrue), fingerprint(node.whenFalse)];
  return ['expression', node.getText().replace(/\s+/g, '')];
}

export function toastIdentityCalls(source, file = 'source.ts') {
  const unit = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS), calls = [];
  const visit = node => {
    if (ts.isCallExpression(node) && sinkNames.has(callName(node.expression)) && node.arguments[0]) {
      const key = translatedToastKey(node.arguments[0]);
      calls.push({ node, key, line: unit.getLineAndCharacterOfPosition(node.getStart(unit)).line + 1,
        valid: !key || JSON.stringify(fingerprint(key)) === JSON.stringify(fingerprint(node.arguments[1])) });
    }
    ts.forEachChild(node, visit);
  };
  visit(unit); return calls;
}

export function missingToastIdentities(source, file = 'source.ts') {
  const calls = toastIdentityCalls(source, file);
  const errors = calls.filter(call => !call.valid)
    .map(call => `${file}:${call.line}: translated toast must carry ${toastKeyText(call.key)}`);
  for (const call of calls.filter(call => !call.key)) {
    let owner = call.node.parent;
    while (owner && !ts.isFunctionLike(owner)) owner = owner.parent;
    const message = unwrap(call.node.arguments[0]);
    if (!owner || !ts.isIdentifier(message) || !owner.parameters[0]
        || owner.parameters[0].name.getText() !== message.text) continue;
    const name = owner.name?.getText() ?? owner.parent?.name?.getText();
    if (!sinkNames.has(name)) continue;
    const id = owner.parameters[1]?.name;
    if (!id || call.node.arguments[1]?.getText() !== id.getText())
      errors.push(`${file}:${call.line}: toast adapter must forward its optional identity`);
  }
  return errors;
}
