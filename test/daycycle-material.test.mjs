import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { daycycleMaterial } from '../demo/helpers/daycycle-material.mjs';
import { generateDemoIcons } from '../demo/gen_icons.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'hp-daycycle-material-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src/icon.ts'), "const icon = 'mdi:eye';\n");
  git('init', '-q'); git('config', 'user.name', 'Synthetic test');
  git('config', 'user.email', 'synthetic@example.invalid');
  generateDemoIcons(root);
  git('add', '.'); git('commit', '-qm', 'Synthetic committed source and prepared icons');
  return { root, git, icons: join(root, 'demo/srv/assets/icons.js') };
}

test('#1276 clean and freshly regenerated icon inputs have exact provenance', t => {
  const f = fixture(t), initial = daycycleMaterial(f.root);
  assert.equal(initial.materialClean, true);
  writeFileSync(join(f.root, 'src/icon.ts'), "const icon = 'mdi:star';\n");
  f.git('add', 'src/icon.ts'); f.git('commit', '-qm', 'New committed icon reference');
  generateDemoIcons(f.root);
  const prepared = daycycleMaterial(f.root);
  assert.equal(prepared.materialClean, true);
  assert.equal(prepared.materialInputs.generatedIcons.verified, true);
  assert.deepEqual(prepared.materialInputs.dirtySources, []);
  assert.notEqual(prepared.materialInputs.generatedIcons.actualSha256, initial.materialInputs.generatedIcons.actualSha256);
  assert.notEqual(prepared.materialInputs.generatedIcons.sourceSha256, initial.materialInputs.generatedIcons.sourceSha256);
});

test('#1276 modifying authored input is invalid even when its generated icons match', t => {
  const f = fixture(t);
  writeFileSync(join(f.root, 'src/icon.ts'), "const icon = 'mdi:star';\n");
  generateDemoIcons(f.root);
  const result = daycycleMaterial(f.root);
  assert.equal(result.materialInputs.generatedIcons.verified, true);
  assert.equal(result.materialClean, false);
  assert.ok(result.materialInputs.dirtySources.some(entry => entry.endsWith('src/icon.ts')));
});

test('#1276 stale, changed and missing prepared assets never become valid evidence', t => {
  const f = fixture(t), old = readFileSync(f.icons);
  writeFileSync(join(f.root, 'src/icon.ts'), "const icon = 'mdi:star';\n");
  f.git('add', 'src/icon.ts'); f.git('commit', '-qm', 'Reference changed without preparation');
  assert.equal(daycycleMaterial(f.root).materialClean, false, 'clean git status cannot prove stale icons');
  generateDemoIcons(f.root);
  writeFileSync(f.icons, old);
  assert.equal(daycycleMaterial(f.root).materialClean, false);
  generateDemoIcons(f.root);
  writeFileSync(f.icons, readFileSync(f.icons, 'utf8') + '// unrelated mutation\n');
  assert.equal(daycycleMaterial(f.root).materialClean, false);
  rmSync(f.icons);
  assert.equal(daycycleMaterial(f.root).materialClean, false);
});

test('#1276 unrelated untracked source and staged output changes remain invalid', t => {
  const f = fixture(t);
  writeFileSync(join(f.root, 'src/new.ts'), '// independent authored input\n');
  assert.equal(daycycleMaterial(f.root).materialClean, false);
  rmSync(join(f.root, 'src/new.ts'));
  writeFileSync(join(f.root, 'src/icon.ts'), "const icon = 'mdi:star';\n");
  f.git('add', 'src/icon.ts'); f.git('commit', '-qm', 'New reference');
  generateDemoIcons(f.root); f.git('add', 'demo/srv/assets/icons.js');
  assert.equal(daycycleMaterial(f.root).materialClean, false);
});
