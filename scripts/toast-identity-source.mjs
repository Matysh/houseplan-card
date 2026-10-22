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
export function translatedToastKey(raw, seen = new Set(), wrappers = new Map()) {
  const node = unwrap(raw);
  if (!node || seen.has(node)) return;
  seen = new Set([...seen, node]);
  if (ts.isCallExpression(node)) {
    const index = translators.get(callName(node.expression));
    if (index !== undefined) return node.arguments[index];
    const candidates = wrappers.get(callName(node.expression));
    if (candidates) {
      const keys=candidates.map(wrapper=>{
      if(wrapper.unsupported)throw Error(`Unsupported toast wrapper ${callName(node.expression)}`);
      const key = unwrap(wrapper.key), start = key.getStart(), patches = [];
      const visit = child => {
        if (ts.isIdentifier(child) && wrapper.parameters.includes(child.text)
            && !(ts.isPropertyAccessExpression(child.parent) && child.parent.name === child)) {
          const argument = node.arguments[wrapper.parameters.indexOf(child.text)];
          if (!argument) throw Error(`Missing argument for toast wrapper ${callName(node.expression)}`);
          const text = argument.getText();
          patches.push({start:child.getStart()-start,end:child.end-start,
            text:ts.isIdentifier(argument)||ts.isPropertyAccessExpression(argument)||ts.isElementAccessExpression(argument)?text:`(${text})`});
        }
        ts.forEachChild(child,visit);
      };
      visit(key);
      let text=key.getText();
      for(const patch of patches.sort((a,b)=>b.start-a.start))text=text.slice(0,patch.start)+patch.text+text.slice(patch.end);
      const parsed=ts.createSourceFile('toast-key.ts',`const id=(${text});`,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
      return unwrap(parsed.statements[0].declarationList.declarations[0].initializer);
      });
      if(keys.some(key=>JSON.stringify(fingerprint(key))!==JSON.stringify(fingerprint(keys[0]))))
        throw Error(`Ambiguous toast wrapper ${callName(node.expression)}`);
      return keys[0];
    }
  }
  if (ts.isConditionalExpression(node)) {
    const yes = translatedToastKey(node.whenTrue, seen, wrappers), no = translatedToastKey(node.whenFalse, seen, wrappers);
    if (yes || no) return { choice: true, condition: node.condition, yes, no };
  }
  if (ts.isIdentifier(node)) return translatedToastKey(constant(node), seen, wrappers);
}

/** Structural inventory: no file/class/method-name anchors. A pure translation
 * wrapper may move to an exported function or be renamed with its callers. */
export function knownToastWrappers(sources) {
  const wrappers=new Map();
  for(const source of typeof sources==='string'?[sources]:sources){
    const unit=ts.createSourceFile('module.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
    const visit=node=>{
      if(ts.isMethodDeclaration(node)||ts.isFunctionDeclaration(node)||ts.isArrowFunction(node)||ts.isFunctionExpression(node)){
        const name=node.name?.getText(unit)??node.parent?.name?.getText(unit);
        const returns=node.body&&ts.isBlock(node.body)?node.body.statements.filter(ts.isReturnStatement):[];
        const expression=node.body&&!ts.isBlock(node.body)?node.body:returns.length===1?returns[0].expression:undefined;
        const key=expression?translatedToastKey(expression):undefined;
        if(name&&key){
          const parameters=node.parameters.map(p=>p.name.getText(unit));let unsupported=!!key.choice;
          const check=child=>{
            if(child.kind===ts.SyntaxKind.ThisKeyword||ts.isCallExpression(child))unsupported=true;
            if(ts.isIdentifier(child)&&!parameters.includes(child.text)
              &&!(ts.isPropertyAccessExpression(child.parent)&&child.parent.name===child))unsupported=true;
            ts.forEachChild(child,check);
          };
          if(!key.choice)check(unwrap(key));
          wrappers.set(name,[...(wrappers.get(name)??[]),{parameters,key,unsupported}]);
        }
      }
      ts.forEachChild(node,visit);
    };
    visit(unit);
  }
  return wrappers;
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

export function toastIdentityCalls(source, file = 'source.ts', wrappers) {
  const unit = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS), calls = [];
  const visit = node => {
    if (ts.isCallExpression(node) && sinkNames.has(callName(node.expression)) && node.arguments[0]) {
      const key = translatedToastKey(node.arguments[0],new Set(),wrappers);
      calls.push({ node, key, line: unit.getLineAndCharacterOfPosition(node.getStart(unit)).line + 1,
        valid: !key || JSON.stringify(fingerprint(key)) === JSON.stringify(fingerprint(node.arguments[1])) });
    }
    ts.forEachChild(node, visit);
  };
  visit(unit); return calls;
}

export function missingToastIdentities(source, file = 'source.ts', wrappers) {
  const calls = toastIdentityCalls(source, file, wrappers);
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
