import { readFileSync } from 'node:fs';
import ts from 'typescript';

/**
 * Source-contract tests historically inspected one monolithic card file.
 * Editor implementations are now lazy, so expose the same logical production
 * surface with the implementation before its typed host stubs.
 *
 * #592: разметка четырёх диалогов настроек уехала из редакторского рантайма в
 * отдельные модули, и в классе остались однострочные делегаты. Контрактные
 * тесты обязаны видеть ту же разметку, что и раньше, поэтому сборка логического
 * исходника подставляет тело вынесенной функции вместо делегата. Иначе шесть
 * тестов пришлось бы переучивать на новые пути — то есть ослаблять их ровно в
 * тот момент, когда они должны доказать, что перенос ничего не изменил.
 */
const DIALOG_MODULES = [
  ['../src/editors/marker-dialog.ts', 'renderMarkerDialog', '_renderMarkerDialog'],
  ['../src/editors/space-settings-dialog.ts', 'renderSpaceSettingsDialog', '_renderSpaceDialog'],
  ['../src/editors/general-settings-dialog.ts', 'renderGeneralSettingsDialog', '_renderSettingsDialog'],
  ['../src/editors/room-settings-dialog.ts', 'renderRoomSettingsDialog', '_renderRoomDialog'],
];

/**
 * #600: форма пространства общая для редактора и онбординга и живёт отдельным
 * модулем; точка входа `renderSpaceSettingsDialog` — тонкая обёртка. Чтобы
 * контрактные тесты продолжали видеть разметку (счётчики пикеров, kind
 * диалога, футер), текст общих модулей дописывается к логическому исходнику.
 * Обращения `port.host.` и `host.` приводятся к `this.`, как и `this.host.`.
 */
const SHARED_DIALOG_MODULES = ['../src/editors/space-form.ts'];

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
  // Тело вынесенного диалога возвращается на место делегата под именем метода:
  // ниже по коду ветка не различает, откуда пришёл текст.
  const moved = new Map();
  for (const [path, exported, method] of DIALOG_MODULES) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    const file = parse(path, source);
    const fn = file.statements.find((statement) => ts.isFunctionDeclaration(statement)
      && statement.name?.text === exported);
    if (!fn) throw new Error(`Houseplan dialog module is missing ${exported}`);
    // #600: тела диалогов держат `const host = this.host` и пишут `host.…`;
    // для контрактных регулярок это тот же `this.…`.
    const body = source.slice(source.indexOf('{', fn.getStart(file)), fn.end)
      .replaceAll(/(?<!this\.)\bhost\./g, 'this.');
    moved.set(method, body);
  }
  const replacements = [];
  for (const member of cardClass.members) {
    const name = nameOf(member, cardFile);
    const implementation = implementations.get(name);
    if (!implementation) continue;
    const baseText = card.slice(member.getStart(cardFile), member.end);
    if (!baseText.includes('_editorRuntime')) continue;
    const visibility = /^(private|protected|public)\b/.exec(baseText)?.[1] || 'private';
    const runtimeText = moved.has(name)
      ? `public ${name}(): TemplateResult ${moved.get(name)}`
      : runtime.slice(implementation.getStart(runtimeFile), implementation.end);
    const implementationText = runtimeText
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
  for (const path of SHARED_DIALOG_MODULES) {
    const shared = readFileSync(new URL(path, import.meta.url), 'utf8')
      .replaceAll('port.host.', 'this.')
      .replaceAll('port.help(', 'this._help(')
      .replaceAll(/(?<!this\.)\bhost\./g, 'this.');
    reconstructed += `\n// --- shared dialog module ${path} ---\n${shared}`;
  }
  return reconstructed;
}
