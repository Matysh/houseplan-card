import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { CONVERTER_CASES } from './cases.mjs';

/** Only called inside runE2E's newly allocated private workspace. */
export function prepareConverterSuite(workspace) {
  const fixtures = path.join(workspace, 'fixtures/process-next-converters');
  mkdirSync(fixtures, { recursive: true });
  for (const row of CONVERTER_CASES) copyFileSync(
    fileURLToPath(new URL(`../../scripts/sh3d-convert/fixtures/${row.file}`, import.meta.url)), path.join(fixtures, row.file));
  for (const [source, target] of [['cases.mjs', 'process-next-converter-cases.mjs'], ['journeys.spec.mjs', 'process-next-converters.spec.mjs']]) {
    copyFileSync(fileURLToPath(new URL(source, import.meta.url)), path.join(workspace, 'tests', target));
  }
  const base = './process-next-converters-base.config.mjs';
  writeFileSync(path.join(workspace, base), `import original from './playwright.config.mjs';
import { USERS } from './scripts/users.mjs';
const admin = original.projects.find(project => project.name === 'admin');
if (!admin) throw Error('Missing companion admin browser settings');
export default { ...original, retries: 0, projects: [...original.projects, {
  name: 'converters', testMatch: /process-next-converters\\.spec\\.mjs$/,
  dependencies: ['setup'], retries: 0,
  use: { ...admin.use, storageState: USERS.admin.storageState }
}] };
`);
  return base;
}
