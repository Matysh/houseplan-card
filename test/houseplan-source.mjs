import { readFileSync } from 'node:fs';
import ts from 'typescript';

/**
 * Source-contract tests historically inspected one monolithic card file.
 * Editor implementations are now lazy, so expose the same logical production
 * surface with the implementation before its typed host stubs.
 */
export function readHouseplanProductionSource() {
  const runtime = readFileSync(
    new URL('../src/houseplan-editor-runtime.ts', import.meta.url),
    'utf8',
  );
  const card = readFileSync(new URL('../src/houseplan-card.ts', import.meta.url), 'utf8');
  const parse = (name, source) => ts.createSourceFile(
    name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS,
  );
  const runtimeFile = parse('houseplan-editor-runtime.ts', runtime);
  const cardFile = parse('houseplan-card.ts', card);
  const classOf = (file, name) => file.statements.find(
    (statement) => ts.isClassDeclaration(statement) && statement.name?.text === name,
  );
  const runtimeClass = classOf(runtimeFile, 'HouseplanEditorRuntime');
  const cardClass = classOf(cardFile, 'HouseplanCard');
  if (!runtimeClass || !cardClass) throw new Error('Houseplan source classes are missing');
  const nameOf = (member, file) => member.name?.getText(file);
  const implementations = new Map(runtimeClass.members
    .map((member) => [nameOf(member, runtimeFile), member])
    .filter(([name]) => name));
  const replacements = [];
  for (const member of cardClass.members) {
    const name = nameOf(member, cardFile);
    const implementation = implementations.get(name);
    if (!implementation) continue;
    const baseText = card.slice(member.getStart(cardFile), member.end);
    if (!baseText.includes('_editorRuntime')) continue;
    const visibility = /^(private|protected|public)\b/.exec(baseText)?.[1] || 'private';
    const implementationText = runtime
      .slice(implementation.getStart(runtimeFile), implementation.end)
      .replace(/^public\b/, visibility)
      .replaceAll('this.host.', 'this.');
    replacements.push({
      from: member.getStart(cardFile),
      to: member.end,
      text: implementationText,
    });
  }
  let reconstructed = card;
  for (const replacement of replacements.sort((a, b) => b.from - a.from)) {
    reconstructed = reconstructed.slice(0, replacement.from)
      + replacement.text
      + reconstructed.slice(replacement.to);
  }
  return reconstructed;
}
