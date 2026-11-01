import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseDocument } from 'yaml';
const files = process.argv.slice(2);
if (!files.length) throw Error('No changed tools selected');
const run = (cmd, args) => {
  const child = spawnSync(cmd, args, { stdio: 'inherit', shell: false });
  if (child.error) throw child.error;
  if (child.status !== 0) process.exit(child.status || 1);
};
for (const file of files) {
  const extension = extname(file);
  if (['.mjs', '.js', '.cjs'].includes(extension)) run(process.execPath, ['--check', file]);
  else if (extension === '.py') run('python3', ['-c', 'import ast,sys; ast.parse(open(sys.argv[1],encoding="utf-8-sig").read(), filename=sys.argv[1])', file]);
  else if (extension === '.json') JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  else if (['.yaml', '.yml'].includes(extension)) {
    const document = parseDocument(readFileSync(file, 'utf8'));
    if (document.errors.length) throw Error(`${file}: ${document.errors.map(error => error.message).join('; ')}`);
  }
}
const typescript = files.filter(file => extname(file) === '.ts');
if (typescript.length) run(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit', '--skipLibCheck', '--target', 'es2022', '--module', 'nodenext', '--moduleResolution', 'nodenext', ...typescript]);
console.log(`Syntax/types: ${files.length} changed files`);
