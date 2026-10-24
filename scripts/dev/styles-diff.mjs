/** Normalized CSS multiset for source composition proof, not cascade proof. */
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { cssOfSource } from '../css-source.mjs';
import { parseRules } from '../css-lex.mjs';

const detect = () => {
  const source = readFileSync('src/styles.ts', 'utf8');
  const ast = ts.createSourceFile('src/styles.ts', source, ts.ScriptTarget.Latest, true);
  const files = cssOfSource(source) ? ['src/styles.ts'] : [];
  for (const statement of ast.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const specifier = statement.moduleSpecifier.text;
    if (specifier.startsWith('./styles/') && specifier.endsWith('.styles')) files.push('src/' + specifier.slice(2) + '.ts');
  }
  return files.length ? files : ['src/styles.ts'];
};
const files = process.argv.slice(2).length ? process.argv.slice(2) : detect();
const rules = files.flatMap(file => {
  const text = cssOfSource(readFileSync(file, 'utf8'), file);
  if (!text) throw Error(`${file}: no css template found`);
  return parseRules(text).map(rule => ({ scope: rule.scope.join(' '), selector: rule.header, declarations: [...rule.declarations].sort() }));
});
rules.sort((a, b) => (a.scope + '|' + a.selector).localeCompare(b.scope + '|' + b.selector)
  || JSON.stringify(a.declarations).localeCompare(JSON.stringify(b.declarations)));
console.log(JSON.stringify(rules, null, 1));
